# E2E de la interfaz (sesión 7b). Requiere: pip install playwright axe-playwright-python; playwright install chromium.
# Uso: bash scripts/e2e/run.sh  (levanta next start en :3055 sobre la base "smoke" y registra el correo en /tmp/srv.log)
import re, json, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright, expect
B='http://localhost:3055'
def log_token(email):
    for _ in range(20):
        t=open('/tmp/srv.log').read()
        m=re.findall(r'Verificación para '+re.escape(email)+r': \S+?token=([A-Za-z0-9_-]+)', t)
        if m: return m[-1]
        time.sleep(.3)
    raise Exception('sin token')
def api(method, path, body=None, token=None):
    req=urllib.request.Request(B+'/api/v1'+path, method=method, data=json.dumps(body).encode() if body else None,
        headers={'content-type':'application/json', **({'authorization':'Bearer '+token} if token else {})})
    return json.load(urllib.request.urlopen(req))

def register_ui(page, name, email, doc, role_label):
    page.goto(B+'/registro')
    page.get_by_label('Nombre completo').fill(name)
    page.get_by_label('Correo electrónico').fill(email)
    page.get_by_label('Contraseña').fill('Clave12345')
    page.get_by_label('Número de documento').fill(doc)
    page.get_by_label('Teléfono').fill('3001234567')
    page.get_by_label(role_label).check()
    page.get_by_label('Acepto los términos').check()
    page.get_by_role('button', name='Registrarme').click()
    expect(page.get_by_role('heading', name='Revisa tu correo')).to_be_visible()

def login_ui(page, email):
    page.goto(B+'/login')
    page.get_by_label('Correo electrónico').fill(email)
    page.get_by_label('Contraseña').fill('Clave12345')
    page.get_by_role('button', name='Ingresar', exact=True).click()
    expect(page.get_by_role('heading', name='Solicitudes')).to_be_visible()

with sync_playwright() as p:
    br=p.chromium.launch()
    ctx_i=br.new_context(viewport={'width':375,'height':800}); pi=ctx_i.new_page()
    errors=[]; pi.on('console', lambda m: errors.append(m.text) if m.type=='error' else None)
    # validación en cliente
    pi.goto(B+'/registro'); pi.get_by_role('button', name='Registrarme').click()
    expect(pi.get_by_text('Elige al menos un perfil')).to_be_visible()
    # login sin verificar → ofrece reenviar
    register_ui(pi,'Ines Inversionista','inv@x.co','80000002','Inversionista')
    login_ui_fail=pi.goto(B+'/login'); pi.get_by_label('Correo electrónico').fill('inv@x.co'); pi.get_by_label('Contraseña').fill('Clave12345')
    pi.get_by_role('button', name='Ingresar', exact=True).click()
    expect(pi.get_by_role('button', name='Reenviar correo de verificación')).to_be_visible()
    # verificar con el enlace del correo (antes daba 404)
    tok=log_token('inv@x.co')
    pi.goto(f'{B}/verificar-correo?token={tok}')
    expect(pi.get_by_text('Tu correo fue verificado')).to_be_visible()
    pi.goto(f'{B}/verificar-correo?token={tok}')
    expect(pi.get_by_text('ya fue utilizado')).to_be_visible()
    # sin sesión, /solicitudes redirige a login
    pi.goto(B+'/solicitudes'); pi.wait_for_url('**/login')
    # productor: registro por UI, verificación, proyecto por API
    pp=br.new_context().new_page()
    register_ui(pp,'Pablo Productor','prod@x.co','80000001','Productor')
    pp.goto(f"{B}/verificar-correo?token={log_token('prod@x.co')}")
    expect(pp.get_by_text('Tu correo fue verificado')).to_be_visible()
    tp=api('POST','/auth/login',{'correo':'prod@x.co','contrasena':'Clave12345'})['data']['accessToken']
    api('POST','/projects',{'nombre':'Maíz tecnificado','descripcion':'d','tipoCultivo':'Maíz','areaRequeridaHa':5,'ubicacionDeseada':'Montería','montoInversion':1000000,'tiempoRetornoMeses':6},tp)
    # inversionista envía solicitud por la UI
    login_ui(pi,'inv@x.co')
    pi.get_by_text('Enviar una solicitud').click()
    pi.get_by_label('Proyecto', exact=True).select_option(index=1)
    pi.get_by_label('Mensaje', exact=True).fill('Me interesa invertir')
    pi.get_by_role('button', name='Enviar solicitud').click()
    expect(pi.get_by_text('Solicitud enviada.')).to_be_visible()
    pi.get_by_role('button', name='Enviadas').click()
    expect(pi.get_by_text('Me interesa invertir')).to_be_visible()
    # duplicada → mensaje de error (el panel sigue abierto)
    pi.get_by_label('Proyecto', exact=True).select_option(index=1)
    pi.get_by_label('Mensaje', exact=True).fill('otra')
    pi.get_by_role('button', name='Enviar solicitud').click()
    expect(pi.get_by_role('alert').filter(has_text='solicitud activa')).to_be_visible()
    # productor: recibe, contrapropone
    login_ui(pp,'prod@x.co')
    expect(pp.get_by_text('Me interesa invertir')).to_be_visible()
    pp.get_by_role('button', name='Contraproponer').click()
    pp.get_by_role('button', name='Enviar contrapropuesta').click()
    expect(pp.get_by_text('Entre 1 y 1000 caracteres')).to_be_visible()
    pp.get_by_label('Mensaje de la contrapropuesta').fill('Mínimo 5 millones')
    pp.get_by_role('button', name='Enviar contrapropuesta').click()
    expect(pp.get_by_text('Contrapropuesta enviada').first).to_be_visible()
    # inversionista acepta la contrapropuesta
    pi.reload(); 
    expect(pi.get_by_text('Mínimo 5 millones')).to_be_visible()
    pi.get_by_role('button', name='Aceptar').click()
    expect(pi.get_by_text('Aceptada').first).to_be_visible()
    # ---- Flujo del productor: proyectos ----
    pp.set_viewport_size({'width':375,'height':800})
    pp.goto(B+'/proyectos')
    expect(pp.get_by_role('link', name='Maíz tecnificado')).to_be_visible()
    pp.get_by_role('link', name='Publicar nuevo proyecto').click()
    pp.get_by_role('button', name='Publicar proyecto').click()
    expect(pp.get_by_role('alert').filter(has_text='Entre 3 y 120 caracteres')).to_be_visible()
    expect(pp.get_by_role('alert').filter(has_text='Entero entre 1 y 600')).to_be_visible()
    pp.get_by_label('Nombre del proyecto').fill('Ñame orgánico')
    pp.get_by_label('Descripción').fill('Siembra de ñame con manejo orgánico')
    pp.get_by_label('Tipo de cultivo o actividad').fill('Ñame')
    pp.get_by_label('Área requerida (hectáreas)').fill('3,5')
    pp.get_by_label('Ubicación deseada').fill('Montería')
    pp.get_by_label('Monto de inversión requerido (COP)').fill('45000000')
    pp.get_by_label('Tiempo estimado de retorno (meses)').fill('10')
    pp.get_by_role('button', name='Publicar proyecto').click()
    expect(pp.get_by_role('heading', name=re.compile('Ñame orgánico'))).to_be_visible()
    pid2=pp.url.rstrip('/').split('/')[-1]
    expect(pp.get_by_text('3.5 ha')).to_be_visible()
    # PDF de soporte: subir, descargar idéntico, rechazar no-PDF
    pdf=b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'
    pp.set_input_files('#pdf', files=[{'name':'Plan económico.pdf','mimeType':'application/pdf','buffer':pdf}])
    expect(pp.get_by_text('Documento guardado.')).to_be_visible()
    expect(pp.get_by_text('Plan economico.pdf')).to_be_visible()
    with pp.expect_download() as d: pp.get_by_role('button', name='Descargar PDF').click()
    assert open(d.value.path(),'rb').read()==pdf, 'PDF descargado distinto'
    pp.set_input_files('#pdf', files=[{'name':'malo.pdf','mimeType':'application/pdf','buffer':b'no soy pdf'}])
    expect(pp.get_by_role('alert').filter(has_text='no es un PDF')).to_be_visible()
    pp.get_by_role('button', name='Eliminar documento').click()
    expect(pp.get_by_text('Documento eliminado.')).to_be_visible()
    # axe en las páginas nuevas (móvil)
    from axe_playwright_python.sync_playwright import Axe
    for path in ['/proyectos','/proyectos/nuevo',f'/proyectos/{pid2}','/solicitudes']:
        pp.goto(B+path); pp.wait_for_load_state('networkidle')
        assert pp.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'scroll horizontal en '+path
        v=Axe().run(pp).response['violations']
        print(path, 'axe:', [(x['id'],x['impact']) for x in v])
    # cierre con confirmación; el cerrado deja de verse para otros usuarios
    pp.goto(f'{B}/proyectos/{pid2}')
    pp.get_by_role('button', name='Cerrar proyecto…').click()
    pp.get_by_role('button', name='Sí, cerrar').click()
    expect(pp.get_by_text('Proyecto cerrado.')).to_be_visible()
    expect(pp.locator('#pdf')).to_have_count(0)
    pi.goto(f'{B}/proyectos/{pid2}')
    expect(pi.get_by_role('alert')).to_be_visible()
    pi.goto(B+'/proyectos'); expect(pi.get_by_text('Solo los productores')).to_be_visible()
    # cerrar sesión en una pestaña la cierra en las demás (mismo contexto)
    pi2=ctx_i.new_page(); pi2.goto(B+'/solicitudes'); expect(pi2.get_by_role('heading', name='Solicitudes')).to_be_visible()
    pi.get_by_role('button', name=re.compile('Salir')).click(); pi.wait_for_url('**/login')
    pi2.wait_for_url('**/login', timeout=5000)
    # expiración por inactividad (RN-09): sesión con last antiguo se descarta al cargar
    login_ui(pi,'inv@x.co')
    pi.evaluate("()=>{const s=JSON.parse(localStorage.getItem('conexagro.session'));s.last=Date.now()-31*60*1000;localStorage.setItem('conexagro.session',JSON.stringify(s))}")
    pi.goto(B+'/solicitudes'); pi.wait_for_url('**/login')
    # sin desbordamiento horizontal en 320 px y accesibilidad
    pi.set_viewport_size({'width':320,'height':700})
    from axe_playwright_python.sync_playwright import Axe
    for path in ['/','/login','/registro']:
        pi.goto(B+path)
        assert pi.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'scroll horizontal en '+path
        v=Axe().run(pi).response['violations']
        print(path, 'axe violaciones:', [(x['id'],x['impact']) for x in v])
    print('errores de consola:', [e for e in errors if 'favicon' not in e and '401' not in e and '409' not in e and '400' not in e])
    br.close()
print('E2E OK')
