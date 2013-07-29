#!/usr/bin/python

from renren_api import RenrenAPI
from renren_api import jsonprint
import os
import json
from getpass import getpass

def login(session_path = "."):
    email = raw_input("Enter your email: ")
    password = getpass("Enter your password: ")
    return RenrenAPI(None, email, password)

renren = login()

friends = renren.getFriends()

if len(friends['friend_list']) != friends['count']:
    print "Warning: count mismatch!"

id_map = { }
other_people = { }

count = len(friends['friend_list'])

for people in friends['friend_list']:
    id_map[people['user_id']] = people

print "Friend Count: %d" % count

index = 1

edges = []

for user_id in id_map:
    people = id_map[user_id]

    # Get shared friends.
    r = renren.getSharedFriends(user_id)
    if r != None:
        if 'friend_list' in r:
            ids = [ x['user_id'] for x in r['friend_list'] ]
        else:
            ids = []
        if len(ids) != r['count']:
            print "Warning: count mismatch!"

        people['share_ids'] = ids
    else:
        people['share_ids'] = []

    # Get all friends.
    r = renren.getFriends(people['user_id'])
    if r != None and 'friend_list' in r:
        for f in r['friend_list']:
            other_people[f['user_id']] = f;
        people['friend_ids'] = [ x['user_id'] for x in r['friend_list'] ]
    else:
        people['friend_ids'] = []

    people['share_ids'] = list(set(people['friend_ids']).intersection(id_map.keys()).union(set(people['share_ids'])))
    pname = people['user_name']
    pname = unicode(pname.encode("gbk"), "gbk", errors = "ignore")
    try:
        print "(%d/%d) %s: %d shared. %d friends. | %d people collected." % (index, count, pname, len(people['share_ids']), len(people['friend_ids']), len(other_people))
    except:
        print "(%d/%d) ???: %d shared. %d friends. | %d people collected." % (index, count, len(people['share_ids']), len(people['friend_ids']), len(other_people))

    index += 1

data_return = {
    "friends": id_map,
    "userinfo": renren.userinfo,
    "all": other_people
}

info = "DATA = %s;" % json.dumps(data_return, ensure_ascii=False, indent=1)
open("friendgraph.js", "w").write(info.encode("utf-8"))
