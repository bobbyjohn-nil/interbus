"""The bake's OpenStreetMap step (PLAN §5): read a pinned extract and clip it to a box as OPL text.

    python tools/bake/osm.py header <file.osm.pbf>
    python tools/bake/osm.py clip <file.osm.pbf|.opl> <west,south,east,north> <out.opl>

`header` prints the extract's replication timestamp as JSON; the fetch step names the mirrored
file by it. `clip` keeps what the bake reads (drivable streets, depot land, water, the places that
become gateways and POIs) and every public-transport feature, which the bake later strips and gate
G10 checks (D17). A way is kept whole if any of its nodes lies in the box; a relation is kept if it
matches and any member it points to was kept, and it lists only the members the clip holds (a bus
route's hundreds of stops elsewhere would otherwise be half the fixture). Output is sorted by type
and id, with no metadata, so the same input and box always give the same bytes.

Only pyosmium (pinned in requirements.txt) and the standard library; run with python -I.
"""

import json
import sys

import osmium

# Streets a bus could drive (V1's drivable classes; PLAN §5 keeps service roads out of the graph),
# plus busways, which D17 opens to all traffic.
DRIVABLE = {
    'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
    'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified',
    'residential', 'living_street', 'road', 'busway', 'bus_guideway',
}
# Places that become trip generators, depots or gateways (PLAN §5).
POI_AMENITY = {'hospital', 'university', 'college', 'school'}
# Public transport the bake removes (D17); kept here so the strip and G10 are tested on real tags.
TRANSIT_ROUTES = {'bus', 'trolleybus', 'train', 'subway', 'light_rail', 'tram', 'monorail', 'ferry'}
TRANSIT_AMENITY = {'bus_station', 'ferry_terminal'}


def keep_area_tags(tags):
    return (
        tags.get('landuse') == 'industrial'
        or tags.get('natural') == 'water'
        or 'water' in tags
        or tags.get('waterway') == 'riverbank'
        or tags.get('amenity') in POI_AMENITY
        or tags.get('leisure') == 'stadium'
        or 'aeroway' in tags
    )


def keep_transit_tags(tags):
    return (
        'railway' in tags
        or 'public_transport' in tags
        or tags.get('highway') == 'bus_stop'
        or tags.get('amenity') in TRANSIT_AMENITY
        or tags.get('route') == 'ferry'
    )


def keep_way(tags):
    return tags.get('highway') in DRIVABLE or keep_area_tags(tags) or keep_transit_tags(tags)


def keep_node(tags):
    return len(tags) > 0 and (keep_area_tags(tags) or keep_transit_tags(tags))


def keep_relation(tags):
    kind = tags.get('type')
    if kind == 'route':
        return tags.get('route') in TRANSIT_ROUTES
    if kind in ('route_master', 'public_transport'):
        return True
    if kind == 'multipolygon':
        return keep_area_tags(tags) or keep_transit_tags(tags)
    return False


def header(path):
    reader = osmium.io.Reader(path)
    try:
        stamp = reader.header().get('osmosis_replication_timestamp', '')
    finally:
        reader.close()
    print(json.dumps({'timestamp': stamp}))


def clip(src, box, out):
    west, south, east, north = box

    def inside(location):
        return location.valid() and west <= location.lon <= east and south <= location.lat <= north

    # Pass 1: matching relations, and the member ways whose geometry a multipolygon needs.
    relations = {}
    area_members = set()
    for rel in osmium.FileProcessor(src, osmium.osm.RELATION):
        if keep_relation(rel.tags):
            ways = [m.ref for m in rel.members if m.type == 'w']
            nodes = [m.ref for m in rel.members if m.type == 'n']
            relations[rel.id] = (ways, nodes)
            if rel.tags.get('type') == 'multipolygon':
                area_members.update(ways)

    # Pass 2: ways with a node in the box (whole, so their nodes come too) and tagged nodes in it.
    ways = set()
    way_nodes = set()
    nodes = set()
    for obj in osmium.FileProcessor(src, osmium.osm.NODE | osmium.osm.WAY).with_locations():
        if obj.is_node():
            if keep_node(obj.tags) and inside(obj.location):
                nodes.add(obj.id)
        elif keep_way(obj.tags) or obj.id in area_members:
            if any(inside(nd.location) for nd in obj.nodes):
                ways.add(obj.id)
                way_nodes.update(nd.ref for nd in obj.nodes)
    kept_relations = {
        rid for rid, (members_w, members_n) in relations.items()
        if any(w in ways for w in members_w) or any(n in nodes for n in members_n)
    }

    # Pass 3: write them in file order (nodes, ways, relations, each by id), without metadata.
    counts = {'nodes': 0, 'ways': 0, 'relations': 0}
    writer = osmium.SimpleWriter(osmium.io.File(out, 'opl,add_metadata=false'), overwrite=True)
    try:
        for obj in osmium.FileProcessor(src):
            if obj.is_node():
                if obj.id in nodes or obj.id in way_nodes:
                    writer.add_node(obj)
                    counts['nodes'] += 1
            elif obj.is_way():
                if obj.id in ways:
                    writer.add_way(obj)
                    counts['ways'] += 1
            elif obj.is_relation() and obj.id in kept_relations:
                held = {'n': lambda ref: ref in nodes or ref in way_nodes, 'w': lambda ref: ref in ways,
                        'r': lambda ref: ref in kept_relations}
                members = [(m.type, m.ref, m.role) for m in obj.members if held[m.type](m.ref)]
                writer.add_relation(obj.replace(members=members))
                counts['relations'] += 1
    finally:
        writer.close()
    print(json.dumps(counts, sort_keys=True))


def main(argv):
    if len(argv) == 2 and argv[0] == 'header':
        header(argv[1])
    elif len(argv) == 4 and argv[0] == 'clip':
        box = [float(x) for x in argv[2].split(',')]
        if len(box) != 4 or not (box[0] < box[2] and box[1] < box[3]):
            raise SystemExit(f'osm: box must be west,south,east,north, got {argv[2]}')
        clip(argv[1], box, argv[3])
    else:
        raise SystemExit(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
