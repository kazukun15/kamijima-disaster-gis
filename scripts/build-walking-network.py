"""Extract a small pedestrian graph from the fixed Shikoku OpenStreetMap PBF.

Install scripts/requirements.txt, download the PBF URL in DATA_SOURCES.md to
data/raw/shikoku-260927.osm.pbf, then run this script from the project root.
The output is an ODbL-derived database and must retain OSM attribution.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

import osmium

SOURCE = Path("data/raw/shikoku-260927.osm.pbf")
TARGET = Path("public/data/walking-network.json")
# Town extent with about 5 km of margin for the 60-minute setting.
BBOX = (133.07, 34.10, 133.42, 34.36)  # west, south, east, north
ROAD_TYPES = {
    "primary", "primary_link", "secondary", "secondary_link", "tertiary",
    "tertiary_link", "unclassified", "residential", "living_street",
    "service", "pedestrian", "footway", "path", "steps", "track", "road",
}
DENIED = {"no", "private"}


def in_box(lon: float, lat: float) -> bool:
    return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]


class PedestrianHandler(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.nodes: dict[int, tuple[float, float]] = {}
        self.edges: list[tuple[int, int, int]] = []
        self.blocked: set[int] = set()
        self.way_count = 0

    def node(self, node: osmium.osm.Node) -> None:
        if node.tags.get("foot") == "no" or (
            node.tags.get("barrier") and node.tags.get("access") in DENIED
        ):
            self.blocked.add(node.id)

    def way(self, way: osmium.osm.Way) -> None:
        tags = way.tags
        kind = tags.get("highway")
        if kind not in ROAD_TYPES or tags.get("area") == "yes":
            return
        if tags.get("foot") in DENIED or tags.get("access") in DENIED:
            return
        if tags.get("motorroad") == "yes" or tags.get("foot") == "use_sidepath":
            return
        if tags.get("sac_scale") not in (None, "hiking"):
            return
        refs = []
        for ref in way.nodes:
            if ref.ref in self.blocked or not ref.location.valid():
                refs.append(None)
            else:
                refs.append((ref.ref, ref.location.lon, ref.location.lat))
        foot_oneway = tags.get("oneway:foot")
        if foot_oneway in ("yes", "1", "true"):
            direction = 1
        elif foot_oneway == "-1":
            direction = -1
        else:
            direction = 0
        allowed_forward = tags.get("foot:forward") not in DENIED
        allowed_backward = tags.get("foot:backward") not in DENIED
        if direction == 1:
            allowed_backward = False
        elif direction == -1:
            allowed_forward = False
        if not allowed_forward and not allowed_backward:
            return
        if not allowed_forward:
            direction = -1
        elif not allowed_backward:
            direction = 1
        included = False
        for a, b in zip(refs, refs[1:]):
            if a is None or b is None or a[0] == b[0]:
                continue
            if not (in_box(a[1], a[2]) or in_box(b[1], b[2])):
                continue
            self.nodes[a[0]] = (a[1], a[2])
            self.nodes[b[0]] = (b[1], b[2])
            self.edges.append((a[0], b[0], direction))
            included = True
        self.way_count += int(included)


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing {SOURCE}")
    handler = PedestrianHandler()
    handler.apply_file(str(SOURCE), locations=True, idx="flex_mem")
    ids = sorted(handler.nodes)
    index = {node_id: i for i, node_id in enumerate(ids)}
    document = {
        "schema": 1,
        "source": "OpenStreetMap contributors (ODbL 1.0)",
        "sourceUrl": "https://download.geofabrik.de/asia/japan/shikoku-260927.osm.pbf",
        "sourceDate": "2026-09-27",
        "processedDate": date.today().isoformat(),
        "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "bbox": BBOX,
        "nodes": [handler.nodes[node_id] for node_id in ids],
        "edges": [[index[a], index[b], direction] for a, b, direction in handler.edges],
    }
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(document, separators=(",", ":")), encoding="utf-8")
    print(f"{handler.way_count} ways, {len(ids)} nodes, {len(handler.edges)} edges; {TARGET.stat().st_size} bytes")


if __name__ == "__main__":
    main()
