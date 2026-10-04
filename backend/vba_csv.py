"""Load local CATIA CSV measurements, retaining exact part identities and provenance."""
from pathlib import Path
import csv
import io
import math
import os
import re

CSV_FOLDER = Path(os.environ.get('AEROPIPE_VBA_CSV_DIR',
    'C:/Users/user/OneDrive/바탕 화면/경진대회/카티아 파일/완성품/Macro/Output'))
GROUP_TYPES = {'HYD_TUBE_ASSEMBLY': '유압계통', 'FUEL_TUBE_ASSEMBLY': '연료계통',
               'ECS_TUBE_ASSEMBLY': '환경제어계통', 'ELEC_TUBE_ASSEMBLY': '전기제어계통'}
FIELDS = {'GroupA','PartNumberA','GroupB','PartNumberB','MinimumDistance_mm','Selected'}

def load_measurements(folder=None):
    folder = Path(folder) if folder is not None else CSV_FOLDER
    if not folder.is_dir():
        raise OSError('VBA CSV 저장 폴더가 없습니다.')
    files = sorted(folder.glob('*.csv'))
    if not files:
        raise ValueError('VBA CSV 저장 폴더에 CSV 파일이 없습니다.')
    merged, parts, superseded = {}, {}, 0
    for path in files:
        raw = path.read_bytes()
        try:
            text = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = raw.decode('cp949')
        reader = csv.DictReader(io.StringIO(text, newline=''))
        if not FIELDS.issubset(reader.fieldnames or []):
            raise ValueError(f'{path.name}: VBA CSV 열 이름이 올바르지 않습니다.')
        stamp = re.search(r'_(\d{8}_\d{6})\.csv$', path.name, re.I)
        # CATIA file names carry the measurement run time. mtime is a fallback.
        priority = (stamp.group(1).replace('_','') if stamp else
                    __import__('datetime').datetime.fromtimestamp(path.stat().st_mtime).strftime('%Y%m%d%H%M%S'))
        for line, row in enumerate(reader, 2):
            if None in row or any(row.get(k) is None for k in FIELDS):
                raise ValueError(f'{path.name} {line}행: CSV 형식이 올바르지 않습니다.')
            a,b = row['PartNumberA'].strip(),row['PartNumberB'].strip()
            ga,gb = row['GroupA'].strip(),row['GroupB'].strip()
            try:
                value = float(row['MinimumDistance_mm'])
            except (TypeError,ValueError):
                raise ValueError(f'{path.name} {line}행: 실측값이 숫자가 아닙니다.')
            selected = row['Selected'].strip().upper()
            if not a or not b or a == b or not math.isfinite(value) or value < 0 or selected not in {'TRUE','FALSE'}:
                raise ValueError(f'{path.name} {line}행: 부품 이름 또는 실측값이 올바르지 않습니다.')
            for name,group in ((a,ga),(b,gb)):
                part={'id':'vba:'+name,'label':name,'sourceId':name,'type':GROUP_TYPES.get(group,''),'group':group}
                if name in parts and parts[name]['group'] != group:
                    raise ValueError(f'{name}: 동일 부품의 계통 정보가 서로 다릅니다.')
                parts[name]=part
            entry={'part_a':a,'part_b':b,'group_a':ga,'group_b':gb,'distance_mm':value,
                   'selected':selected == 'TRUE','source_file':path.name,'measured_at':priority}
            key=tuple(sorted((a,b)))
            prior=merged.get(key)
            if prior:
                superseded+=1
                if prior['measured_at']==priority and prior['distance_mm']!=value:
                    raise ValueError(f'{a} ↔ {b}: 같은 측정 시각에 서로 다른 값이 있습니다.')
                if prior['measured_at']>priority:
                    continue
            merged[key]=entry
    measurements=list(merged.values())
    if not measurements:
        raise ValueError('CSV 파일에 측정 데이터가 없습니다.')
    defaults={}
    for row in measurements:
        key=tuple(sorted((row['group_a'],row['group_b'])))
        if key not in defaults or row['distance_mm']<defaults[key]['distance_mm']:
            defaults[key]=row
    return {'parts':[parts[k] for k in sorted(parts)],'measurements':measurements,
            'default_pairs':list(defaults.values()),'file_count':len(files),'row_count':len(measurements),
            'superseded_count':superseded,'folder':str(folder)}
