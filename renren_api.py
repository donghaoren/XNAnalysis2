import hashlib
import urllib
import json
import time
import copy
import gzip
import StringIO
import subprocess
import pycurl

API_KEY = '5f58df0c570f4be7a340e7cf548a8b7d'
API_SEC = 'caa335608f8340d1be2a4d4a6b244da0'

#from urlgrabber.grabber import URLGrabber
#grabber = URLGrabber(reget = 'simple')
curl = pycurl.Curl()

def jsonprint(p):
    x = json.dumps(p, ensure_ascii=False, indent=2)
    print x
    return x

def computeSig(request, sec):
    kvs = []

    for key in request:
        kv = key + "=" + request[key][0:50]
        kvs.append(kv)

    s = "".join(sorted(kvs))

    return str(hashlib.md5(s + sec).hexdigest())

def api_get(path, params, session = None):
    for retry_time in range(0, 5):
        if retry_time > 0:
            print "Request %s failed, retry %d..." % (path, retry_time)
        r = api_get_ex(path, params, session)
        if r != None: return r
    return None


def api_get_ex(path, params, session = None):
    request = copy.deepcopy(params)
    request['call_id'] = str(int(time.time() * 1000))
    request['uniq_id'] = '353596052021392'
    request['v'] = '1.0'
    request['gz'] = 'compression'
    request['client_info'] = '{"screen":"720*1184","os":"15_4.0.4","model":"LT29i","other":"46000,","uniqid":"353596052021391","mac":"18:00:2d:d3:9b:3b","from":8000000,"version":"5.6.3"}'
    request['format'] = 'JSON'
    request['api_key'] = API_KEY
    if session == None:
        sig = computeSig(request, API_SEC)
    else:
        request['session_key'] = session[0]
        sig = computeSig(request, session[1])
    req = urllib.urlencode(request)
    try:
        url = "http://api.m.renren.com/" + path

        #data = urllib.urlopen(url, req + "&sig=" + sig).read()
        #data = gzip.GzipFile(fileobj=StringIO.StringIO(data)).read()
        buf = StringIO.StringIO()
        curl.setopt(pycurl.URL, url + "?" + req + "&sig=" + sig)
        curl.setopt(pycurl.WRITEFUNCTION, buf.write)
        curl.setopt(pycurl.CONNECTTIMEOUT, 10)
        curl.setopt(pycurl.TIMEOUT, 10)
        curl.perform()
        data = buf.getvalue()
        buf.close()

        #data = grabber.urlread(url + "?" + req + "&sig=" + sig)
        data = gzip.GzipFile(fileobj=StringIO.StringIO(data)).read()
        data = unicode(data, "utf-8", errors='ignore')

        result = json.loads(data)
        if 'error_code' in result:
            print "Error %s" % path, result
            return None
        return result
    except:
        return None

def login(username, password):
    request = {
     'password': hashlib.md5(password).hexdigest(),
     'uniq_id': '353596052021392',
     'user': username,
     'api_key': '5f58df0c570f4be7a340e7cf548a8b7d',
     'isverify': '1'
    }
    result = api_get("api/client/login", request)
    if result != None:
        return (result['session_key'], result['secret_key'])
    return None

class RenrenAPI:
    def __init__(self, file, username, password):
        try:
            f = open(file, "r")
            self.session = json.loads(f.read())
            f.close()
            self.userinfo = api_get("api/user/getInfo", {
                "type": "65535"
            }, self.session)
            if self.userinfo and 'user_name' in self.userinfo:
                self.user_id = self.userinfo['uid']
                return None
            else: raise Exception("Failed to login.")
        except:
            session = login(username, password)
            if session == None: raise Exception("Failed to login.")
            self.session = session
            self.userinfo = api_get("api/user/getInfo", {
                "type": "65535"
            }, self.session)
            if self.userinfo and 'user_name' in self.userinfo:
                self.user_id = self.userinfo['uid']
                if file != None:
                    open(file, "w").write(json.dumps(session))
                return None
            else: raise Exception("Failed to login.")

    def loadContactsMatch(self, file):
        self.cm_uid2name = { }
        self.cm_name2uid = { }
        f = open(file, "r")
        pairs = json.loads(f.read())
        f.close()
        for uid, name in pairs:
            self.cm_name2uid[name] = uid
            self.cm_uid2name[uid] = name

    def getVisitors(self):
        request = {
          'page_size': '100'
        }
        return api_get("api/user/getVisitors", request, self.session)

    def getFeeds(self, page = 1, count = 100):
        request = {
          'page': str(page),
          'page_size': '50',
          'type': '102,103,104,107,110,501,502,504,601,701,709,1101,1104,1105,2003,2004,2005,2006,2008,2009,2012,2013,2015,8001,8002,8015,2002,8905,8906,105'
        }
        return api_get("api/feed/get", request, self.session)

    def getUserInfo(self, uid = None):
        if uid == None: uid = self.user_id
        return api_get("api/user/getInfo", {
            "uid": str(uid),
            "type": "65535"
        }, session)

    def getGossip(self, uid = None, page = 1, page_size = 50):
        if uid == None: uid = self.user_id
        return api_get("api/gossip/gets", {
            "user_id": str(uid),
            "page": str(page),
            "page_size": str(page_size)
        }, self.session)

    def getEmotions(self):
        return api_get("api/status/getEmoticons", {
            "type": "all",
            "isall": "1"
        }, self.session)

    def getNewsList(self):
        return api_get("api/news/newsList", {
            "type": "7",
            "sub_types": "14,15,16,17,18,19,24,25,26,27,28,36,58,59,129,142,166,170,171,172,173,175,196,197,216,217,220,256,501,502,537,635,100001,100002,100003,100004,100005,100006,100007,100008,100009,100010,100011,100012,100013,100014,100015,100016,100017,100018,100019,100020,100040",
            "page_size": "100"
        }, self.session)
    def getNewsPush(self):
        return api_get("api/news/push", {
            "sub_types": "14,15,16,17,18,19,24,25,26,27,28,36,58,59,129,142,166,170,171,172,173,175,196,197,216,217,220,256,501,502,537,635,100001,100002,100003,100004,100005,100006,100007,100008,100009,100010,100011,100012,100013,100014,100015,100016,100017,100018,100019,100020,100040",
            "page_size": "100"
        }, self.session)

    def getAlbum(self, uid, aid):
        return api_get("api/photos/get", {
            "uid": uid,
            "aid": aid,
            "all": "1"
        }, self.session)

    def getUserInfo(self, uid):
        return api_get("api/user/getInfo", {
            "uid": str(uid),
            "type": "65535"
        }, self.session)

    def getFriends(self, uid = None):
        if uid == None:
            return api_get("api/friends/getFriends", {
                'pageSize': '5000',
                "hasGender": "1",
                "hasNetwork": "1",
                "hasGroup": "1"
            }, self.session)
        else:
            return api_get("api/friends/getFriends", {
                'pageSize': '5000',
                "hasGender": "1",
                "hasNetwork": "1",
                "hasGroup": "1",
                "userId": str(uid)
            }, self.session)

    def getSharedFriends(self, uid, page = 1, page_size = 5000):
        return api_get("api/friends/getSharedFriends", {
            "userId": str(uid),
            "page": str(page),
            "page_size": str(page_size)
        }, self.session)
