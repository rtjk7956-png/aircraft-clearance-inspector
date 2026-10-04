from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .inspection import inspect_rows
from .specification_bridge import lookup, list_options
from .ai_causes import FailureInput, AnalysisUnavailable, analyze

from .mail_routing import MailInput, DirectoryInput, directory, save_directory, route_mail

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title='AeroPipe CSV Inspection', version='1.0.0')
app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', 'testserver'])


@app.middleware('http')
async def no_cache(request, call_next):
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.get('/api/health')
def health():
    return {'status': 'ok', 'mode': 'local_csv'}


@app.get('/api/specification/options')
def specification_options():
    try:
        return list_options()
    except (ValueError, KeyError, TypeError, UnicodeError) as error:
        raise HTTPException(422, detail='부품 목록 CSV의 형식을 확인해 주세요.') from error
    except OSError as error:
        raise HTTPException(503, detail='data 폴더의 CSV 파일을 읽을 수 없습니다.') from error


@app.get('/api/specification')
def specification(pair: str = Query('', max_length=300),
                  condition: str = Query('', max_length=500), diameter: str = Query('', max_length=100)):
    try:
        return lookup(pair, condition, diameter)
    except (ValueError, KeyError, TypeError) as error:
        raise HTTPException(422, detail=str(error)) from error
    except OSError as error:
        raise HTTPException(503, detail='data 폴더의 규격 CSV와 Python 파일을 확인해 주세요.') from error


@app.get('/api/inspections')
@app.post('/api/inspections')
def inspections():
    try:
        return inspect_rows()
    except (ValueError, KeyError, TypeError, UnicodeError) as error:
        raise HTTPException(422, detail=str(error)) from error
    except OSError as error:
        raise HTTPException(503, detail='data 폴더의 CSV 파일을 읽을 수 없습니다.') from error


@app.post('/api/ai/causes')
def ai_causes(item: FailureInput):
    try:
        return analyze(item)
    except ValueError as error:
        raise HTTPException(422, detail=str(error)) from error
    except AnalysisUnavailable as error:
        raise HTTPException(503, detail=str(error)) from error
    except OSError as error:
        raise HTTPException(503, detail='규격 데이터 또는 로컬 AI 설정을 읽을 수 없습니다.') from error


@app.get('/api/mail/contacts')
def mail_contacts():
    try:return {'contacts':directory()}
    except (OSError,ValueError):raise HTTPException(503,detail='계통별 담당자 파일을 읽을 수 없습니다.')

@app.put('/api/mail/contacts')
def update_mail_contacts(item: DirectoryInput):
    try:return save_directory(item)
    except ValueError as error:raise HTTPException(422,detail=str(error)) from error
    except OSError as error:raise HTTPException(503,detail='담당자 설정을 저장할 수 없습니다.') from error

@app.post('/api/ai/mail-routing')
def ai_mail_routing(item: MailInput):
    try:return route_mail(item)
    except ValueError as error:raise HTTPException(422,detail=str(error)) from error
    except AnalysisUnavailable as error:raise HTTPException(503,detail=str(error)) from error
    except OSError as error:raise HTTPException(503,detail='담당자 또는 AI 설정 파일을 읽을 수 없습니다.') from error

# The original home layout keeps HTML/JS at the root. Publish only frontend files.
@app.get('/{filename:path}', include_in_schema=False)
def frontend(filename: str):
    target = (ROOT / (filename or 'index.html')).resolve()
    allowed = {'.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico'}
    if target.parent != ROOT.resolve() or target.suffix.lower() not in allowed or not target.is_file():
        raise HTTPException(404, detail='Not found')
    return FileResponse(target)
