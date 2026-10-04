import csv
import shutil
from pathlib import Path

from fastapi.testclient import TestClient
from backend.main import app
from backend import inspection

client = TestClient(app)


def test_real_csv_and_api():
    response = client.get('/api/inspections')
    assert response.status_code == 200
    data = response.json()
    assert data['summary'] == {'total': 6, 'pass': 2, 'fail': 4, 'review': 0, 'verdict': 'FAIL'}
    assert [r['minimum_mm'] for r in data['results']] == [152.4, 152.4, 9.525, 40.0, 18.0, 30.0]
    assert data['results'][1]['deviation_mm'] == -12.4
    assert client.post('/api/inspections').json()['results'] == data['results']


def test_lookup_and_static_isolation():
    response = client.get('/api/specification', params={'pair': '산소 배관 ↔ 전기 라인'})
    assert response.status_code == 200
    assert response.json()['minimum_mm'] == 152.4
    assert client.get('/api/specification', params={'pair': 'a' * 301}).status_code == 422
    assert client.get('/page2.html').status_code == 200
    assert client.get('/inspection-results.js').status_code == 200
    assert client.get('/data/measurement_data.csv').status_code == 404
    assert client.get('/backend/main.py').status_code == 404
    assert client.get('/api/health').json()['status'] == 'ok'


def fixture_csv(tmp_path, monkeypatch):
    shutil.copy(inspection.DATA / 'specification_data.csv', tmp_path)
    monkeypatch.setattr(inspection, 'DATA', tmp_path)
    monkeypatch.setattr(inspection.tool, 'BASE', tmp_path)
    return tmp_path / 'measurement_data.csv'


def write_rows(path, rows):
    fields = ['Item_A', 'Item_A_Type', 'Item_B', 'Item_B_Type', 'Condition', 'Clearance_mm', 'Wire_OD_mm', 'Max_Wire_OD_mm', 'Cable_OD_mm']
    with path.open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fields)
        writer.writeheader()
        writer.writerows(rows)


def test_invalid_measurements_and_boundary(tmp_path, monkeypatch):
    path = fixture_csv(tmp_path, monkeypatch)
    base = dict(Item_A='A', Item_B='B', Item_A_Type='Oxygen Plumbing', Item_B_Type='Electrical line', Condition='')
    write_rows(path, [dict(base, Clearance_mm=x) for x in ('nan', '-1', 'bad', '152.4', '152.3999')])
    data = client.get('/api/inspections').json()
    assert [r['verdict'] for r in data['results']] == ['REVIEW', 'REVIEW', 'REVIEW', 'PASS', 'FAIL']


def test_unknown_rule_and_missing_diameter(tmp_path, monkeypatch):
    path = fixture_csv(tmp_path, monkeypatch)
    write_rows(path, [dict(Item_A='A', Item_B='B', Item_A_Type='unknown', Item_B_Type='unknown', Clearance_mm='1'),
                      dict(Item_A='A', Item_B='B', Item_A_Type='Wire bundle', Item_B_Type='Wire bundle 자체', Condition='일반적인 굽힘', Clearance_mm='42')])
    assert all(r['verdict'] == 'REVIEW' for r in client.get('/api/inspections').json()['results'])


def test_empty_missing_and_malformed_csv(tmp_path, monkeypatch):
    path = fixture_csv(tmp_path, monkeypatch)
    assert client.get('/api/inspections').status_code == 503
    path.write_text('wrong,columns\n1,2\n', encoding='utf-8')
    assert client.get('/api/inspections').status_code == 422
    write_rows(path, [])
    assert client.get('/api/inspections').json()['summary']['verdict'] == 'REVIEW'
