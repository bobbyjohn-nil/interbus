"""Overture's building heights for the map file (city-boston-r1; PLAN §5's height row).

    python tools/bake/overture.py heights <release> <west,south,east,north> <out.csv.gz>

Reads one Overture Maps release's buildings from its public bucket
(s3://overturemaps-us-west-2/release/<release>/theme=buildings/type=building/), keeps those whose
bounding box meets the box and which carry a height, and writes each as a point inside its
footprint (shapely's point_on_surface) in degrees to 7 places, and its height in metres to 0.1:
`lon,lat,height`. Rows are sorted by Overture id and gzipped with no name or time, so the same
release and box always give the same bytes. The City heights workflow mirrors the file as a
pinned, hashed input; the tiles bake (tools/bake/tiles.mjs heights) reads only that copy.

pyarrow, shapely and numpy pinned in requirements-overture.txt; run with python -I.
"""

import gzip
import io
import sys

import pyarrow.compute as pc
import pyarrow.dataset as ds
import pyarrow.fs as pafs
import shapely


def heights(release, box, out):
    west, south, east, north = box
    s3 = pafs.S3FileSystem(anonymous=True, region='us-west-2')
    data = ds.dataset(f'overturemaps-us-west-2/release/{release}/theme=buildings/type=building/', filesystem=s3, format='parquet')
    meets = (
        (pc.field('bbox', 'xmin') <= east)
        & (pc.field('bbox', 'xmax') >= west)
        & (pc.field('bbox', 'ymin') <= north)
        & (pc.field('bbox', 'ymax') >= south)
    )
    table = data.to_table(columns=['id', 'height', 'geometry'], filter=meets)
    found = table.num_rows
    table = table.filter(pc.is_valid(table.column('height')))
    table = table.sort_by('id')
    points = shapely.point_on_surface(shapely.from_wkb(table.column('geometry').to_numpy(zero_copy_only=False)))
    lons = shapely.get_x(points)
    lats = shapely.get_y(points)
    text = io.StringIO()
    text.write('lon,lat,height\n')
    for lon, lat, height in zip(lons, lats, table.column('height').to_pylist()):
        text.write(f'{lon:.7f},{lat:.7f},{height:.1f}\n')
    with open(out, 'wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, compresslevel=9, mtime=0) as f:
            f.write(text.getvalue().encode('utf-8'))
    print(f'overture: {release}: {found} buildings meet the box, {table.num_rows} with a height, written to {out}')


def main(argv):
    if len(argv) == 4 and argv[0] == 'heights':
        box = [float(v) for v in argv[2].split(',')]
        if len(box) != 4:
            raise SystemExit('overture: the box is west,south,east,north')
        heights(argv[1], box, argv[3])
    else:
        raise SystemExit(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
