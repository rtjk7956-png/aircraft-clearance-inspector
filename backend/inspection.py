"""Inspect CSV measurements using the original clearance calculation functions."""
import csv
import importlib.util
import math
from datetime import datetime, timezone
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'
module_spec = importlib.util.spec_from_file_location('clearance_source', DATA / 'clearance_tool.py')
tool = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(tool)


def number(value, label, positive=False):
    result = float(value)
    if not math.isfinite(result) or result < 0 or (positive and result == 0):
        raise ValueError(f'{label}: 유효한 양의 수 또는 0이 필요합니다.')
    return result


def inspect_rows():
    rules = tool.load_specifications()
    required_rules = {'Item_A_Type', 'Item_B_Type', 'Condition', 'Rule_Type',
                      'Rule_Value', 'Rule_Unit', 'Reference_Dimension', 'Source'}
    if not rules or any(not required_rules.issubset(rule) for rule in rules):
        raise ValueError('specification_data.csv의 규격 또는 열 이름을 확인해 주세요.')
    with (DATA / 'measurement_data.csv').open(encoding='utf-8-sig', newline='') as source:
        reader = csv.DictReader(source)
        required = {'Item_A', 'Item_B', 'Item_A_Type', 'Item_B_Type', 'Condition', 'Clearance_mm'}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError('measurement_data.csv의 필수 열이 누락되었습니다.')
        measurements = list(reader)
    results = []
    for index, row in enumerate(measurements, start=1):
        item = {'id': index, 'item_a': (row.get('Item_A') or '').strip(),
                'item_b': (row.get('Item_B') or '').strip(),
                'condition': (row.get('Condition') or '').strip(),
                'measured_mm': None, 'minimum_mm': None, 'deviation_mm': None,
                'verdict': 'REVIEW', 'source': '', 'message': ''}
        try:
            if not item['item_a'] or not item['item_b']:
                raise ValueError('부품명이 누락되었습니다.')
            measured = number(row.get('Clearance_mm'), '실측값')
            item['measured_mm'] = measured
            rule = tool.find_specification(rules, (row.get('Item_A_Type') or '').strip(),
                                           (row.get('Item_B_Type') or '').strip(), item['condition'])
            if rule is None:
                raise ValueError('부품 종류와 조건에 해당하는 규격이 없습니다.')
            number(rule['Rule_Value'], '규격값', positive=True)
            if rule['Rule_Type'].strip() == 'MULTIPLIER':
                reference = {'WIRE_OD': 'Wire_OD_mm', 'MAX_WIRE_OD': 'Max_Wire_OD_mm',
                             'CABLE_OD': 'Cable_OD_mm'}.get(rule['Reference_Dimension'].strip())
                if reference is None:
                    raise ValueError('지원하지 않는 직경 기준입니다.')
                number(row.get(reference), '기준 직경', positive=True)
            minimum = number(tool.calculate_minimum_clearance(rule, row), '최소 요구거리')
            item.update(minimum_mm=round(minimum, 6), deviation_mm=round(measured - minimum, 6),
                        verdict='PASS' if measured >= minimum else 'FAIL', source=rule['Source'],
                        message='최소 굽힘 반경' if rule['Rule_Type'].strip() == 'MULTIPLIER' else '최소 이격거리')
        except (ValueError, TypeError, KeyError) as error:
            item['message'] = str(error)
        results.append(item)
    counts = {state.lower(): sum(row['verdict'] == state for row in results)
              for state in ('PASS', 'FAIL', 'REVIEW')}
    summary = {'total': len(results), **counts,
               'verdict': 'FAIL' if counts['fail'] else ('REVIEW' if counts['review'] or not results else 'PASS')}
    return {'checked_at': datetime.now(timezone.utc).isoformat(), 'summary': summary, 'results': results,
            'measurement_source': 'measurement_data.csv', 'specification_source': 'specification_data.csv'}
