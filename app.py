from flask import render_template, request, Response
from sqlalchemy.exc import SQLAlchemyError
from functools import wraps
import hmac, requests
from models import Route, create_app, create_tables

app = create_app()
routes = {}

def load_routes():
    global routes
    try:
        all_routes = Route.query.all()
        routes = {
            route.url: {
                'name': route.name,
                'bucket': route.bucket,
                'username': route.username,
                'password': route.password
            }
            for route in all_routes
        }
    except SQLAlchemyError as e:
        print(f"Database error: {str(e)}")  


@app.errorhandler(401)
def unauth(e):
    return render_template('401.html'), 401

@app.errorhandler(403)
def forbbiden(e):
    return render_template('403.html'), 403

@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def not_found(e):
    return render_template('500.html'), 500


def check_auth(username, password, bucket):
    for values in routes.values():
        if values["bucket"] == bucket and hmac.compare_digest(values["username"], username) and hmac.compare_digest(values["password"], password):
            return True
    return False

def authenticate():
    return Response(
        'Could not verify your login!', 401,
        {'WWW-Authenticate': 'Basic realm="Login required"'}
    )

def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password, kwargs['bucket_name']):
            return authenticate()
        return f(*args, **kwargs)
    return decorated

@app.route('/<x>', methods=['GET'])
def route_detail(x):
    load_routes()
    if x in routes:
        return render_template('index.html', title=routes[x]["name"], bucket=routes[x]["bucket"])

    return render_template('404.html'), 404



@app.route('/api/<bucket_name>', methods=['GET'])
@requires_auth
def proxy(bucket_name):
    prefix = request.args.get('prefix', '')
    delimiter = request.args.get('delimiter', "%2F")
    s3_url = f"https://127.0.0.1:9000/{bucket_name}?list-type=2&prefix={prefix}&delimiter={delimiter}"

    try:
        response = requests.get(s3_url, verify=False)

        if response.status_code != 200:
            return Response(f"{response.status_code} - {response.content}", status=response.status_code)

        return Response(response.content, content_type='application/xml')

    except requests.RequestException as e:
        return Response(str(e), status=500)


with app.app_context():
    create_tables(app)
    load_routes()

if __name__ == '__main__':
    app.run(port=5005)