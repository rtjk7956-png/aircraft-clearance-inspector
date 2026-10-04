"""Read the user's original clearance_tool and CSV rules, without AI calls."""
from pathlib import Path
import ast
import csv
import importlib.util
import math
import re

AGENT = Path(__file__).resolve().parent.parent.parent / 'Aerospace_AI_Agent'


def compact(value):
    return re.sub(r'\s+', '', value).casefold()


def load_tool():
    spec = importlib.util.spec_from_file_location('aero_clearance_source', AGENT / 'clearance_tool.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_csv(name):
    with (AGENT / name).open(encoding='utf-8-sig', newline='') as source:
        return list(csv.DictReader(source))


def aliases():
    tree = ast.parse((AGENT / 'workflow_agent.py').read_text(encoding='utf-8-sig'))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'TYPE_ALIASES' for t in node.targets):
            return ast.literal_eval(node.value)
    return {}


def lookup(pair, condition='', diameter=''):
    pair = pair.strip()
    if not pair:
        return {'status':'empty', 'message':'부품 A ↔ 부품 B를 입력해 주세요.'}
    if len(pair) > 300 or len(condition) > 500:
        raise ValueError('입력 내용이 너무 깁니다.')
    tool = load_tool()
    rules = tool.load_specifications()
    measurements = read_csv('measurement_data.csv')
    structural = read_csv('clearance_data.csv')
    for row in structural:
        if compact(pair) == compact(row['Part']):
            return {'status':'ok', 'minimum_mm':float(row['Min']), 'maximum_mm':float(row['Max']), 'source':'clearance_data.csv · ' + row['Part'], 'message':'등록된 구조물 간격 범위', 'rule_kind':'clearance'}
    values = re.split(r'\s*(?:↔|<->|→|,|&|\s+-\s+|\s+vs\.?\s+|\s+and\s+)\s*', pair, flags=re.I)
    if len(values) == 1:
        values = re.split(r'(?<=\S)(?:와|과)\s*', pair)
    if len(values) != 2 or not all(values):
        return {'status':'needs_pair', 'message':'두 부품을 ↔로 구분해 주세요. 예: 산소 배관 ↔ 전기 라인 / OxygenPipe02 ↔ ElectricalLine01'}
    types = {r[k].strip() for r in rules for k in ('Item_A_Type','Item_B_Type')}
    type_aliases = aliases()
    def resolve(value):
        possibilities = set()
        for canonical in types:
            if compact(value) in {compact(s) for s in (canonical, *type_aliases.get(canonical, ()))}:
                possibilities.add(canonical)
        for row in measurements:
            for suffix in ('A','B'):
                if compact(row['Item_' + suffix]) == compact(value):
                    possibilities.add(row['Item_' + suffix + '_Type'].strip())
        return next(iter(possibilities)) if len(possibilities) == 1 else None
    a, b = map(resolve, values)
    if not a or not b:
        return {'status':'unknown', 'message':'등록된 부품 종류 또는 부품명으로 입력해 주세요. 예: 산소 배관 ↔ 전기 라인. 이 조합을 추정해 판정하지 않습니다.'}
    candidates = [r for r in rules if (r['Item_A_Type'].strip(), r['Item_B_Type'].strip()) in {(a,b),(b,a)}]
    if not candidates:
        return {'status':'not_found', 'message':f'{a} ↔ {b} 조합의 규격이 등록되어 있지 않습니다.'}
    conditions = sorted({r['Condition'].strip() for r in candidates if r['Condition'].strip()})
    if conditions and condition not in conditions:
        return {'status':'needs_condition', 'conditions':conditions, 'message':'적용할 설치·굽힘 조건을 선택해 주세요.'}
    selected = tool.find_specification(rules,a,b,condition)
    if not selected:
        return {'status':'not_found', 'conditions':conditions, 'message':'선택한 조건에 해당하는 규격을 찾지 못했습니다.'}
    context = {}
    multiplier = selected['Rule_Type'].strip() == 'MULTIPLIER'
    reference = selected['Reference_Dimension'].strip()
    if multiplier:
        required = {'WIRE_OD':'Wire_OD_mm','MAX_WIRE_OD':'Max_Wire_OD_mm','CABLE_OD':'Cable_OD_mm'}.get(reference)
        if not required:
            raise ValueError('지원하지 않는 직경 기준입니다.')
        try:
            number = float(diameter)
        except (ValueError, TypeError):
            number = 0
        if not math.isfinite(number) or number <= 0:
            return {'status':'needs_diameter', 'conditions':conditions, 'reference':reference, 'factor':float(selected['Rule_Value']), 'source':selected['Source'], 'message':'굽힘 반경 규격입니다. 기준이 되는 실제 직경(mm)을 입력해 주세요.'}
        context[required] = str(number)
    minimum = tool.calculate_minimum_clearance(selected, context)
    if not math.isfinite(minimum) or minimum < 0:
        raise ValueError('규격표의 수치를 확인해 주세요.')
    return {'status':'ok', 'minimum_mm':round(minimum,3), 'source':selected['Source'], 'conditions':conditions, 'reference':reference if multiplier else '', 'rule_kind':'bend_radius' if multiplier else 'clearance', 'item_a_type':a, 'item_b_type':b, 'message':'최소 굽힘 반경 기준' if multiplier else '최소 이격거리 기준'}
