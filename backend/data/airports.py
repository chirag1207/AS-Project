"""
data/airports.py
Embedded airport coordinate database.
Format: ICAO → (lat, lon, name, elevation_ft)

To add an airport: append a new entry to AIRPORTS.
No external service needed — coordinates are looked up locally.
"""
from typing import Optional

AIRPORTS: dict[str, tuple] = {
    # ── USA ───────────────────────────────────────────────────────────────────
    "KDFW": (32.8968, -97.0380, "Dallas/Fort Worth Intl",         607),
    "KLAX": (33.9425,-118.4081, "Los Angeles Intl",               125),
    "KJFK": (40.6413, -73.7781, "John F Kennedy Intl",             13),
    "KORD": (41.9742, -87.9073, "Chicago O'Hare",                 668),
    "KATL": (33.6407, -84.4277, "Atlanta Hartsfield-Jackson",    1026),
    "KSFO": (37.6213,-122.3790, "San Francisco Intl",              13),
    "KLAS": (36.0840,-115.1537, "Las Vegas Harry Reid",          2181),
    "KDEN": (39.8561,-104.6737, "Denver Intl",                   5431),
    "KBOS": (42.3656, -71.0096, "Boston Logan",                    19),
    "KSEA": (47.4502,-122.3088, "Seattle-Tacoma",                 433),
    "KMIA": (25.7959, -80.2870, "Miami Intl",                       8),
    "KPHX": (33.4373,-112.0078, "Phoenix Sky Harbor",            1135),
    "KIAH": (29.9902, -95.3368, "Houston George Bush",             98),
    "KDTW": (42.2162, -83.3554, "Detroit Metro",                  645),
    "KMSP": (44.8848, -93.2223, "Minneapolis-St Paul",            841),
    "KEWR": (40.6925, -74.1687, "Newark Liberty",                  18),
    "KLGA": (40.7772, -73.8726, "New York LaGuardia",              22),
    "KPHL": (39.8719, -75.2411, "Philadelphia Intl",               36),
    "KFLL": (26.0726, -80.1527, "Fort Lauderdale-Hollywood",        9),
    "KBWI": (39.1754, -76.6683, "Baltimore/Washington",           146),
    "KSLC": (40.7884,-111.9778, "Salt Lake City",                4227),
    "KPDX": (45.5898,-122.5951, "Portland Intl",                   31),
    "KCLT": (35.2140, -80.9431, "Charlotte Douglas",              748),
    "KMCO": (28.4294, -81.3089, "Orlando Intl",                    96),
    "KTPA": (27.9755, -82.5332, "Tampa Intl",                      26),
    "KMDW": (41.7868, -87.7524, "Chicago Midway",                 620),
    "KBNA": (36.1245, -86.6782, "Nashville Intl",                 599),
    "KAUS": (30.1975, -97.6664, "Austin Bergstrom",               542),
    "KDAL": (32.8471, -96.8517, "Dallas Love Field",              487),
    "KHOU": (29.6454, -95.2789, "Houston Hobby",                   46),
    "KSNA": (33.6757,-117.8682, "John Wayne Orange County",        56),
    "KSAN": (32.7338,-117.1933, "San Diego Intl",                  17),
    "KOAK": (37.7213,-122.2208, "Oakland Intl",                     9),
    "KSJC": (37.3626,-121.9290, "San Jose Intl",                   62),
    "KSAC": (38.5125,-121.4927, "Sacramento Intl",                 27),
    "KRNO": (39.4991,-119.7681, "Reno-Tahoe",                   4415),
    "KABQ": (35.0402,-106.6091, "Albuquerque Intl Sunport",      5355),
    "KELP": (31.8072,-106.3779, "El Paso Intl",                  3959),
    "KSAT": (29.5337, -98.4698, "San Antonio Intl",               809),
    "KMEM": (35.0424, -89.9767, "Memphis Intl",                   341),
    "KMSY": (29.9934, -90.2580, "New Orleans Louis Armstrong",      4),
    "KJAX": (30.4941, -81.6879, "Jacksonville Intl",               30),
    "KCVG": (39.0488, -84.6678, "Cincinnati/Northern Kentucky",   896),
    "KIND": (39.7173, -86.2944, "Indianapolis",                   797),
    "KCMH": (39.9980, -82.8919, "Columbus",                       815),
    "KPIT": (40.4915, -80.2329, "Pittsburgh Intl",               1203),
    "KBUF": (42.9405, -78.7322, "Buffalo Niagara",                728),
    "KRDU": (35.8777, -78.7875, "Raleigh-Durham",                 435),
    "KRIC": (37.5052, -77.3197, "Richmond",                       167),
    "KCHS": (32.8986, -80.0405, "Charleston SC",                   46),
    "KSAV": (32.1276, -81.2021, "Savannah/Hilton Head",            50),
    "KPBI": (26.6832, -80.0956, "Palm Beach Intl",                 19),
    "KRSW": (26.5362, -81.7552, "Southwest Florida",               30),
    "KSDF": (38.1774, -85.7360, "Louisville Muhammed Ali",        501),
    "KSTL": (38.7487, -90.3700, "St Louis Lambert",               618),
    "KMKE": (42.9472, -87.8966, "Milwaukee Mitchell",             723),
    "KCLE": (41.4117, -81.8498, "Cleveland Hopkins",              791),
    "KDAY": (39.9024, -84.2194, "Dayton",                        1009),
    "KDSM": (41.5340, -93.6631, "Des Moines",                     958),
    "KOMA": (41.3032, -95.8941, "Omaha Eppley",                   984),
    "KICT": (37.6499, -97.4331, "Wichita Dwight D Eisenhower",  1333),
    "KTUL": (36.1984, -95.8881, "Tulsa Intl",                     677),
    "KOKC": (35.3931, -97.6007, "Oklahoma City Will Rogers",     1295),
    "KLIT": (34.7294, -92.2243, "Little Rock Clinton National",   262),
    "KBOI": (43.5644,-116.2228, "Boise",                         2858),
    "KBZN": (45.7775,-111.1531, "Bozeman Yellowstone",           4473),
    "KBIL": (45.8077,-108.5428, "Billings Logan",                3652),
    "KGTF": (47.4820,-111.3709, "Great Falls",                   3680),
    "KGEG": (47.6199,-117.5339, "Spokane",                       2376),
    "KVNY": (34.2098,-118.4899, "Van Nuys",                       802),
    "KASE": (39.2232,-106.8689, "Aspen Pitkin Co/Sardy Field",   7820),
    # ── Europe ────────────────────────────────────────────────────────────────
    "EGLL": (51.4775,  -0.4614, "London Heathrow",                 83),
    "EGKK": (51.1481,  -0.1903, "London Gatwick",                 202),
    "EHAM": (52.3086,   4.7639, "Amsterdam Schiphol",             -11),
    "EDDF": (50.0264,   8.5431, "Frankfurt Main",                 364),
    "EDDM": (48.3537,  11.7750, "Munich",                        1487),
    "LFPG": (49.0097,   2.5478, "Paris Charles de Gaulle",        392),
    "LEMD": (40.4719,  -3.5626, "Madrid Barajas",                1998),
    "LEBL": (41.2971,   2.0785, "Barcelona El Prat",               12),
    "LIRF": (41.8003,  12.2389, "Rome Fiumicino",                  14),
    "LSZH": (47.4647,   8.5492, "Zurich",                        1416),
    "LOWW": (48.1103,  16.5697, "Vienna",                         600),
    "EBBR": (50.9014,   4.4844, "Brussels Zaventem",              184),
    "EKCH": (55.6180,  12.6561, "Copenhagen Kastrup",              17),
    "ENGM": (60.1939,  11.0999, "Oslo Gardermoen",                681),
    "ESSA": (59.6519,  17.9186, "Stockholm Arlanda",              137),
    "EFHK": (60.3172,  24.9633, "Helsinki Vantaa",                179),
    "LPPT": (38.7813,  -9.1359, "Lisbon Humberto Delgado",        374),
    "LPPR": (41.2481,  -8.6814, "Porto Francisco Sa Carneiro",    228),
    "UUEE": (55.9726,  37.4146, "Moscow Sheremetyevo",            630),
    "LTBA": (40.9769,  28.8146, "Istanbul Ataturk",               163),
    # ── Middle East ───────────────────────────────────────────────────────────
    "OMDB": (25.2532,  55.3657, "Dubai Intl",                      62),
    "OBBI": (26.2708,  50.6336, "Bahrain Intl",                     6),
    "OTHH": (25.2731,  51.6080, "Doha Hamad Intl",                 13),
    # ── Asia-Pacific ──────────────────────────────────────────────────────────
    "VHHH": (22.3080, 113.9185, "Hong Kong Intl",                  28),
    "RJTT": (35.5533, 139.7811, "Tokyo Haneda",                    35),
    "RJAA": (35.7647, 140.3864, "Tokyo Narita",                   141),
    "RKSI": (37.4602, 126.4407, "Seoul Incheon",                   23),
    "ZBAA": (40.0799, 116.6031, "Beijing Capital",                116),
    "ZSPD": (31.1443, 121.8083, "Shanghai Pudong",                 13),
    "WSSS": ( 1.3644, 103.9915, "Singapore Changi",                22),
    "VTBS": (13.6811, 100.7470, "Bangkok Suvarnabhumi",             5),
    "VIDP": (28.5562,  77.1000, "Delhi Indira Gandhi",            777),
    "VABB": (19.0896,  72.8656, "Mumbai Chhatrapati Shivaji",      37),
    "YSSY":(-33.9461, 151.1772, "Sydney Kingsford Smith",          21),
    "YMML":(-37.6733, 144.8430, "Melbourne Tullamarine",          434),
    "NZAA":(-37.0082, 174.7917, "Auckland",                        23),
    # ── Africa ────────────────────────────────────────────────────────────────
    "FACT":(-33.9649,  18.6017, "Cape Town Intl",                 151),
    "HECA": (30.1219,  31.4056, "Cairo Intl",                     382),
    "FAOR":(-26.1392,  28.2460, "Johannesburg O.R. Tambo",       5558),
    # ── Latin America ─────────────────────────────────────────────────────────
    "SBGR":(-23.4356, -46.4731, "Sao Paulo Guarulhos",           2459),
    "SBGL":(-22.8099, -43.2505, "Rio de Janeiro Galeao",           28),
    "SCEL":(-33.3930, -70.7858, "Santiago Arturo Merino",        1555),
    "SAEZ":(-34.8222, -58.5358, "Buenos Aires Ezeiza",             67),
    "SKBO": ( 4.7016, -74.1469, "Bogota El Dorado",              8357),
    "MMMX": (19.4363, -99.0721, "Mexico City Intl",              7316),
    "MMUN": (21.0365, -86.8771, "Cancun Intl",                     22),
    "MMMY": (25.7699,-100.1063, "Monterrey Gen Mariano",         1278),
}

def get_coords(icao: str) -> Optional[tuple]:
    """Return (lat, lon, name, elev_ft) for an ICAO code, or None if not found."""
    return AIRPORTS.get(icao.upper())

def search(query: str, limit: int = 20) -> list[dict]:
    """Search airports by ICAO prefix or name substring."""
    q = query.upper().strip()
    results = [
        {"icao": icao, "lat": lat, "lon": lon, "name": name, "elevation_ft": elev}
        for icao, (lat, lon, name, elev) in AIRPORTS.items()
        if q in icao or q.lower() in name.lower()
    ]
    return sorted(results, key=lambda x: x["icao"])[:limit]
