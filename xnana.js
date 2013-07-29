var software_version = "002.000.000.000";
var version_short = "2.0.0";

function progress_begin() {
    $("#progress-info").html("");
    $("#progress-window").fadeIn();
}
function progress_end() {
    $("#progress-window").fadeOut();
}
function progress_stage(title, desc) {
    $("#progress-title").html(title);
    if(desc != undefined)
        $("#progress-description").html(desc);
    else $("#progress-description").html("");
}
function progress_info(info, cls) {
    if(cls != undefined)
        $("#progress-info").append('<li class="' + cls + '">' + info + '</li>');
    else $("#progress-info").append('<li>' + info + '</li>');
}
function progress_percentage(percentage) {
    $("#progress-percentage-inner").css('width',
        parseInt($("#progress-percentage").css('width').replace('px','')) * percentage + "px"
    );
}

if(typeof(DATA) != "undefined") {
    $("#start-here").html('<b><a id="clickMe" onclick="xnana_run(); return false;" href="#">点击这里开始</a></b>');
} else {
    $("#start-here").html('尚未获取数据，请先运行 python 脚本 friendgraph.py。');
}

var g_graphdata;

DATA.all[DATA.userinfo.uid] = DATA.userinfo;
DATA.userinfo.friend_ids = [];
for(var i in DATA.friends) {
    DATA.userinfo.friend_ids.push(parseInt(i));
    DATA.all[i] = DATA.friends[i];
}
DATA.userinfo.friend_ids.sort(function(a, b) { return parseInt(a) - parseInt(b); });

for(var i in DATA.all) {
    DATA.all[i].common_friends = 0;
}
for(var i in DATA.friends) {
    DATA.friends[i].friend_ids.forEach(function(id) {
        DATA.all[id].common_friends += 1;
    });
}

var getFriendList = function(callback) {
    result = [ ];
    var friends = DATA.friends;
    for(var i in friends) {
        friends[i].user_id = friends[i].user_id.toString();
        result.push(friends[i]);
    }
    setTimeout(function() {
        callback(result);
    }, 1);
};

var getShareFriends = function(uid, callback) {
    setTimeout(function() {
        callback(DATA.friends[uid].share_ids.map(function(x) { return x.toString(); }));
    }, 1);
};

function intersect_safe(a, b) {
    var ai = 0, bi = 0;
    var result = new Array();
    while(ai < a.length && bi < b.length) {
        if(a[ai] < b[bi]) { ai++; }
        else if(a[ai] > b[bi]) { bi++; }
        else {
            result.push(a[ai]);
            ai++;
            bi++;
        }
    }
    return result;
}

var getShareFriendsN = function(uids) {
    if(uids.length == 0) return [];
    var f0 = DATA.all[uids[0]].friend_ids;
    for(var i = 1; i < uids.length; i++) {
        f0 = intersect_safe(f0, DATA.all[uids[i]].friend_ids);
    }
    return f0;
};

var getShareFriends2 = function(uid1, uid2) {
    return getShareFriendsN([uid1, uid2]);
};

function xnana_run() {
    progress_begin();
    progress_stage("步骤 1/4: 正在读取好友列表");
    getFriendList(function(friends_list) {
        var edges = new Array();
        var map = {};

        friends = friends_list.map(function(f, index) {
            map[f.user_id] = index + 1;
            return [ f.user_id, f.user_name, f.head_url, [] ];
        });
        // Add yourself.
        var my_uid = DATA.userinfo.uid.toString();
        var my_name = DATA.userinfo.user_name;
        map[my_uid] = 0;

        friends.unshift([my_uid, my_name, DATA.userinfo.large_url, []]);
        map[my_uid] = 0;
        for(var i = 1; i < friends.length; i++) {
            edges.push([my_uid, friends[i][0]]);
        }
        // Now we have: uid, uname, upic, obj.

        progress_info("找到 " + friends.length + " 个好友。", "status");
        progress_stage("步骤 2/4: 正在读取好友关系", "这需要一定时间，请耐心等待...");
        var idx = 1;
        var getting_ = false;
        var timer = setInterval(function() {
            if(getting_) return;
            if(idx >= friends.length) {
                // We're done. Next step.
                clearInterval(timer);
                var medges = [];
                for(var e = 0; e < edges.length; e++) {
                    var strength = 1;
                    if(edges[e][0] != my_uid && edges[e][1] != my_uid) {
                        strength = getShareFriends2(edges[e][0], edges[e][1]).length;
                        strength = 1 + Math.sqrt(1 + strength) / 10;
                    }
                    medges.push([
                        map[edges[e][0]],
                        map[edges[e][1]],
                        strength
                    ]);
                }
                var request_obj = {
                    friends: friends,
                    edges: edges,
                    mapped_edges: medges,
                    map: map
                };
                request_obj.request_date = new Date();
                xnana_layout(request_obj);
                return;
            }
            // Not done, fetch next page.
            var url = "http://friend.renren.com/shareFriends?&p=";
            url += JSON.stringify({"uid":"true", "param":{"guest":friends[idx][0]}});
            getting_ = true;
            getShareFriends(friends[idx][0], function(list) {
                list.forEach(function(uid) {
                    var j = map[uid];
                    if(j != undefined)
                        edges.push([friends[idx][0], uid]);
                });
                idx++;
                progress_percentage((idx + 1) / friends.length);
                getting_ = false;
            });
        }, 1);
    });
}
function get_date_string() {
    var date = new Date();
    mon = (date.getMonth() + 1).toString();
    if(mon.length < 2) mon = "0" + mon;
    day = date.getDate().toString();
    if(day.length < 2) day = "0" + day;
    hh = date.getHours().toString();
    if(hh.length < 2) hh = "0" + hh;
    mm = date.getMinutes().toString();
    if(mm.length < 2) mm = "0" + mm;
    ss = date.getSeconds().toString();
    if(ss.length < 2) ss = "0" + ss;
    s = date.getFullYear() + "-" + mon + "-" + day + "-" + hh+mm+ss;
    return s;
}
function xnana_layout(req) {
    progress_stage("步骤 3/4: 正在生成好友网络", "这需要一定时间，请耐心等待...");
    var n = req.friends.length;
    var edges = req.mapped_edges;

    var R = [];
    var onlayoutend = function() {
        // Rescale.
        var minx = 1e10, miny = 1e10, maxx = -1e10, maxy = -1e10;
        var mind = 1e10;
        for(var i = 0; i < n; i++) {
            minx = Math.min(minx, R[i][0]);
            maxx = Math.max(maxx, R[i][0]);
            miny = Math.min(miny, R[i][1]);
            maxy = Math.max(maxy, R[i][1]);
        }
        var deltax = (maxx-minx) * 0.1;
        var deltay = (maxy-miny) * 0.1;
        minx -= deltax;
        miny -= deltay;
        maxx += deltax;
        maxy += deltay;
        for(var i = 0; i < n; i++) {
            R[i][0] -= minx;
            R[i][1] -= miny;
        }
        var g_graphdata = {};
        g_graphdata.request_date = req.request_date;
        g_graphdata.friends = req.friends;
        g_graphdata.layout = {
            g_width : maxx - minx,
            g_height : maxy - miny,
            n_edges : edges.length,
            n_nodes : req.friends.length,
            n_data : R,
            n_offsets : [ minx, miny ],
            e_data : edges
        };
        show_result(g_graphdata);
        progress_end();
        swtab("graph");
    };
    setTimeout(function() {
        var ctx = jsfr_initialize(n, edges, {
            size : Math.sqrt(n) * 70
        });
        var n_iter = n * 4;
        if(n_iter < 300) n_iter = 300;
        var iter_num = 0;
        var timer = setInterval(function() {
            if(iter_num >= n_iter) {
                clearInterval(timer);
                R = ctx.nodes;
                progress_stage("步骤 4/4: 正在绘制关系图...");
                setTimeout(onlayoutend(), 10);
            } else {
                for(var i = 0; i < 10; i++)
                    ctx.iterate();
                progress_percentage((iter_num + 1) / n_iter);
                iter_num += 10;
            }
        }, 10);
    }, 30);
}

function swtab(s) {
    $('.page_tab').css('display', 'none');
    $('#tab_'+s).css('display','block');
    $('.tabbutton').removeClass('active');
    $('#tabbutton_'+s).addClass("active");
}

var current_running_timer = undefined;
var current_data = undefined;
var current_scale = 'medium';

var toggle_name = function() {};

function show_result(dat) {
    current_data = dat;
    var i_wh;
    if(current_scale == 'small') i_wh = 0.4;
    if(current_scale == 'medium') i_wh = 0.7;
    if(current_scale == 'normal') i_wh = 1.0;
    if(current_scale == 'large') i_wh = 1.3;
    var i_scale = i_wh;
    var use_image = true;
    var friends = dat.friends;
    var g_width = dat.layout.g_width;
    var g_height = dat.layout.g_height;
    var n_edges = dat.layout.n_edges;
    var n_nodes = dat.layout.n_nodes;
    var e_data = dat.layout.e_data;
    var n_data = dat.layout.n_data;
    var n_offsets = dat.layout.n_offsets;
    var holder = document.getElementById('canvas_holder');
    var canvas = document.getElementById('canvas_graph');
    var mask = document.getElementById('canvas_mask');
    var middle = document.getElementById('middle_layer');
    var imgs = document.getElementById('canvas_images');
    var svg = document.getElementById('svg_users');
    var current_active_idx = [];
    var node_lock = [];
    for(var i = 0; i < n_nodes; i++) node_lock[i] = false;
    imgs.innerHTML = "";
    mask.width = canvas.width = g_width * i_scale;
    mask.height = canvas.height = g_height * i_scale;
    middle.style.width = imgs.style.width = holder.style.width = g_width * i_scale + "px";
    middle.style.height = imgs.style.height = holder.style.height = g_height * i_scale + "px";
    svg.setAttribute('width', g_width * i_scale);
    svg.setAttribute('height', g_height * i_scale);
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    $('#middle_layer').addClass('invisible');

    var cmask = mask.getContext('2d');

    var draw_timeline;


    if(dat.request_date != undefined)
        $("#current_result_info").html("Date: " + new Date(dat.request_date).format());

    var get_gender = function(idx) {
        var f = DATA.friends[friends[idx][0]];
        if(!f) f = DATA.userinfo;
        var cl = (f && f.gender == "男生") ? "M" : "F";
        return cl;
    };

    var get_gender_color = function(idx) {
        var g = get_gender(idx);
        return g == "M" ? "31,119,180" : "255,127,14";
    };

    var draw_graph = function() {
        var c = canvas.getContext('2d');
        c.clearRect(0, 0, g_width * i_scale, g_height * i_scale);

        for(var i = 0; i < n_edges; i++) {
            c.beginPath();
            c.moveTo(i_scale * n_data[e_data[i][0]][0], i_scale * n_data[e_data[i][0]][1]);
            c.lineTo(i_scale * n_data[e_data[i][1]][0], i_scale * n_data[e_data[i][1]][1]);
            var alpha = 0.1 + e_data[i][2] / 1000;
            if(current_scale == 'small')
                alpha *= 0.3;
            else
                alpha *= 0.7;
            c.strokeStyle = 'rgba(150,150,150,' + alpha + ')';
            c.stroke();
        }
        c.strokeStyle = 'rgba(0,0,0,1)';
        c.fillStyle = 'rgba(255,255,255,1)';
        for(var i = 0; i < n_nodes; i++) {
            x = n_data[i][0] * i_scale;
            y = n_data[i][1] * i_scale;
            c.fillStyle = 'rgba(255,255,255,1)';
            var r = 5;
            var grad = c.createRadialGradient(x, y, 0, x, y, r);
            var cl = get_gender_color(i);
            grad.addColorStop(0, "rgba(" + cl + ", 1)");
            grad.addColorStop(0.5, "rgba(" + cl + ", 0.7)");
            grad.addColorStop(1, "rgba(" + cl + ", 0)");
            c.beginPath();
            c.arc(x, y, r, 0, Math.PI * 2, true);
            c.closePath();
            c.fillStyle = grad;
            c.fill();
/*
            c.beginPath();
            c.arc(x, y, 2, 0, Math.PI * 2, true);
            c.closePath();
            c.fillStyle = 'rgba(255,255,255,1)';
            c.fill();*/
        }
    };

    var select_person = function(idx, clear) {
        var idx_map = {};
        if(idx === undefined || clear) current_active_idx = [];
        current_active_idx.forEach(function(d) { idx_map[d] = 1; });
        if(idx !== undefined) {
            if(idx_map[idx]) delete idx_map[idx];
            else idx_map[idx] = 1;
        }
        current_active_idx = [];
        for(var i in idx_map) {
            current_active_idx.push(i);
        }
        draw_mask();
    };
    var select_person_notoggle = function(idx, clear) {
        var idx_map = {};
        if(idx === undefined || clear) current_active_idx = [];
        current_active_idx.forEach(function(d) { idx_map[d] = 1; });
        if(idx !== undefined) {
            idx_map[idx] = 1;
        }
        current_active_idx = [];
        for(var i in idx_map) {
            current_active_idx.push(i);
        }
    };

    var draw_mask = function(mask_only) {
        var friend_ids = { };
        getShareFriendsN(current_active_idx.map(function(d) { return friends[d][0]; }))
            .forEach(function(d) { friend_ids[d] = 1; });
        var selected_ids = { };
        current_active_idx.map(function(d) { return friends[d][0]; })
            .forEach(function(d) {
                selected_ids[d] = 1;
                friend_ids[d] = 1;
            });
        cmask.clearRect(0, 0, g_width * i_scale, g_height * i_scale);
        for(ei = 0; ei < n_edges; ei++) {
            var idx = e_data[ei][0];
            var tov = e_data[ei][1];
            if((selected_ids[friends[idx][0]] && friend_ids[friends[tov][0]]) ||
               (selected_ids[friends[tov][0]] && friend_ids[friends[idx][0]])) {
                cmask.beginPath();
                cmask.moveTo(i_scale * n_data[idx][0], i_scale * n_data[idx][1]);
                cmask.lineTo(i_scale * n_data[tov][0], i_scale * n_data[tov][1]);
                cmask.strokeStyle = 'rgba(255,127,14,0.1)';
                cmask.stroke();
            }
        }
        for(var i = 0; i < n_nodes; i++) {
            if(friend_ids[friends[i][0]]) {
                x = n_data[i][0] * i_scale;
                y = n_data[i][1] * i_scale;
                cmask.fillStyle = 'rgba(255,255,255,1)';
                var r = 5;
                var grad = cmask.createRadialGradient(x, y, 0, x, y, r);
                var cl = get_gender_color(i);
                grad.addColorStop(0, "rgba(" + cl + ", 1)");
                grad.addColorStop(0.5, "rgba(" + cl + ", 0.7)");
                grad.addColorStop(1, "rgba(" + cl + ", 0)");
                cmask.beginPath();
                cmask.arc(x, y, r, 0, Math.PI * 2, true);
                cmask.closePath();
                cmask.fillStyle = grad;
                cmask.fill();
            }
        }
        if(mask_only) return;
        $("#user-list").children().remove();
        for(var i = 0; i < n_nodes; i++) {
            var info = DATA.all[friends[i][0]];
            if(selected_ids[friends[i][0]]) {
                svg.getElementById('usernode-' + i).setAttribute('class', 'selected-center');
                var li = $("<li />").addClass("group");
                var div = $('<div />').addClass("info");
                li.append($('<img />').attr("src", info.head_url));
                li.append(div);
                div.append($('<a />').text(info.user_name)
                                     .addClass("name")
                                     .attr("href", "http://www.renren.com/" + info.user_id)
                                     .attr("target", "_blank"));
                div.append($('<span />').text("共同好友: " + info.common_friends + " " + info.gender + " " + info.network));
                $("#user-list").append(li);
            } else if(friend_ids[friends[i][0]]) {
                svg.getElementById('usernode-' + i).setAttribute('class', 'selected');
            } else {
                svg.getElementById('usernode-' + i).setAttribute('class', '');
            }
        }
        $("#common-list").children().remove();
        var infos = [];
        var count_my_friends = 0;
        for(var id in friend_ids) {
            var info = DATA.all[id];
            if(id != DATA.userinfo.uid) {
                if(!DATA.friends[id])
                    infos.push(info);
                else count_my_friends++;
            }
        }
        infos.sort(function(a, b) { return b.common_friends - a.common_friends; });
        $("#common-list").append($("<li />").text("我的好友: " + count_my_friends));
        infos.forEach(function(info) {
            var li = $("<li />").addClass("group");
            var div = $('<div />').addClass("info");
            li.append($('<img />').attr("src", info.head_url));
            li.append(div);
            div.append($('<a />').text(info.user_name)
                                     .addClass("name")
                                     .attr("href", "http://www.renren.com/" + info.user_id)
                                     .attr("target", "_blank"));
            div.append($('<span />').text("共同好友: " + info.common_friends + " " + info.gender + " " + info.network));
            $("#common-list").append(li);
        });
    }
    current_select_user = function(uid) {
        for(var i in dat.friends) {
            if(dat.friends[i][0] == uid) {
                select_person(i, true);
                $("body").scrollLeft(-$(window).width() / 2 + n_data[i][0] * i_scale);
                $("body").scrollTop(-$(window).height() / 2 + n_data[i][1] * i_scale);
                return;
            }
        }
    }

    setTimeout(function() {
        $("body").scrollTop(($("#canvas_holder").height()-$(window).height())/2);
        $("body").scrollLeft(($("#canvas_holder").width()-$(window).width())/2);
        draw_graph();
        cmask.clearRect(0, 0, g_width * i_scale, g_height * i_scale);
    }, 10);

    if(current_scale == 'large') {
        $("#svg_users").hide();
        $("#canvas_images").show();
        for(var i = 0; i < n_nodes; i++) {
            x = n_data[i][0] * i_scale;
            y = n_data[i][1] * i_scale;
            if(use_image) {
                subnode = document.createElement('div');
                pnode = document.createElement('div');
                pnode.appendChild(subnode);
                pnode.id = "person-"+i;
                pnode.className = "person-box";
                tg = document.createElement('span');
                tg.innerHTML = friends[i][1];
                var image = new Image();
                image.src = friends[i][2];
                image.id = "personimg-"+i;
                pnode.style.left = x + "px";
                pnode.style.top = y + "px";
                subnode.appendChild(image);
                subnode.appendChild(tg);
                imgs.appendChild(pnode);
                subnode.__index = i;
                pnode.__index = i;
                pnode.onmousedown = function() {
                    var idx = this.__index;
                    $('.person-box').removeClass('selected');
                    $('.person-box').addClass('inactive');
                    select_person(idx);
                    $('#person-' + idx).removeClass('inactive');
                    $('#person-' + idx).addClass('selected');
                    $('#person-' + idx).addClass('dragging');
                    $('#middle_layer').removeClass('invisible');

                    this._startx = parseInt(this.style.left.replace('px',''));
                    this._starty = parseInt(this.style.top.replace('px',''));
                    var e = window.event;
                    this._mousex = e.screenX;
                    this._mousey = e.screenY;
                    this._dragging = true;
                    window._draggingobj = this;
                    e.preventDefault();
                }
            }
        }
        window.onmousemove = function() {
            if(window._draggingobj != undefined) {
                window._should_iterate = 1;
                var e = window.event;
                var x = window._draggingobj._startx + e.screenX - window._draggingobj._mousex;
                var y = window._draggingobj._starty + e.screenY - window._draggingobj._mousey;
                if(x > canvas.width) x = canvas.width;
                if(x < 0) x = 0;
                if(y > canvas.height) y = canvas.height;
                if(y < 0) y = 0;
                window._draggingobj.style.left = x + "px";
                window._draggingobj.style.top = y + "px";
                window._draggingobj._dragged = true;
                n_data[window._draggingobj.__index][0] = x / i_scale;
                n_data[window._draggingobj.__index][1] = y / i_scale;
                select_person_notoggle(window._draggingobj.__index);
                draw_mask(true);
            }
        }
        window.onmouseup = function() {
            $(window._draggingobj).removeClass("dragging");
            if(window._draggingobj != undefined && window._draggingobj._dragged != undefined) {
                draw_graph();
            }
            window._draggingobj = undefined;
            window._should_iterate = undefined;
        }
        $('#canvas_mask').unbind('click');
        $('#canvas_mask').click(function() {
            cmask.clearRect(0, 0, g_width * i_scale, g_height * i_scale);
            select_person();
            $('.person-box').removeClass('inactive');
            $('.person-box').removeClass('selected');
            $('#middle_layer').addClass('invisible');
            return false;
        });
        toggle_name = function() {
            $("#canvas_images").toggleClass('hidename');
        };
    } else {
        $("#svg_users").show();
        $("#canvas_images").hide();
        var prevent_svgclick = false;
        var user_nodes = [];
        if(current_scale == 'small') svg.setAttribute('class', 'small');
        else svg.setAttribute('class', '');
        toggle_name = function() {
            if(svg.getAttribute('class') == '')
                svg.setAttribute('class', 'small');
            else svg.setAttribute('class', '');
        };
        for(var i = 0; i < n_nodes; i++) {
            x = n_data[i][0] * i_scale;
            y = n_data[i][1] * i_scale;
            var g = document.createElementNS("http://www.w3.org/2000/svg", 'g');
            g.setAttribute('transform', 'translate(' + x + ',' + y + ')');
            g.setAttribute('id', 'usernode-' + i);
            g.setAttribute("gender", get_gender(i));
            var c = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
            c.setAttribute('r', current_scale == 'medium' ? '4' : '2');
            g._index = i;
            g.onmousedown = function() {
                prevent_svgclick = true;
                var idx = this._index;
                select_person(idx);
                this._startx = parseInt(this.style.left.replace('px',''));
                this._starty = parseInt(this.style.top.replace('px',''));
                var e = window.event;
                window.drag_info = {
                    index: idx,
                    mouseX: e.screenX,
                    mouseY: e.screenY,
                    x0: n_data[idx][0] * i_scale,
                    y0: n_data[idx][1] * i_scale
                };
                window.onmousemove = function() {
                    var e = window.event;
                    var dx = e.screenX - window.drag_info.mouseX;
                    var dy = e.screenY - window.drag_info.mouseY;
                    n_data[window.drag_info.index][0] = (window.drag_info.x0 + dx) / i_scale;
                    n_data[window.drag_info.index][1] = (window.drag_info.y0 + dy) / i_scale;
                    select_person_notoggle(window.drag_info.index);
                    draw_mask(true);
                    window.drag_info.dragged = true;
                    update_image_position();
                };
                window.onmouseup = function() {
                    if(window.drag_info != undefined && window.drag_info.dragged != undefined) {
                        draw_graph();
                    }
                    window.onmousemove = undefined;
                    window.drag_info = undefined;
                };
                e.preventDefault();
                $('#middle_layer').removeClass('invisible');
                return false;
            }
            g.onmouseover = function() { // svg reordering
                svg.appendChild(this);
            }
            var txt = document.createElementNS("http://www.w3.org/2000/svg", 'text');
            txt.textContent = friends[i][1];
            txt.setAttribute('y', -5);
            var cb = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
            cb.setAttribute('r', '8');
            cb.setAttribute('class', 'back');
            g.appendChild(cb);
            g.appendChild(c);
            g.appendChild(txt);
            svg.appendChild(g);
            user_nodes.push(g);
        }
        svg.onclick = function() {
            if(prevent_svgclick) { prevent_svgclick = false; return false; }
            cmask.clearRect(0, 0, g_width * i_scale, g_height * i_scale);
            select_person();
            $('#middle_layer').addClass('invisible');
            return false;
        };
    }

    var update_image_position = function() {
        for(var i = 0; i < n_nodes; i++) {
            var x = n_data[i][0] * i_scale;
            var y = n_data[i][1] * i_scale;
            if(current_scale == 'large') {
                $("#person-"+i).css('left',x+'px');
                $("#person-"+i).css('top',y+'px');
            } else {
                svg.getElementById('usernode-'+i).setAttribute('transform',
                    'translate(' + x + ',' + y + ')'
                );
            }
        }
    };
}
function switch_size(sz) {
    if(current_data) {
        current_scale = sz;
        if(current_running_timer != undefined) {
            clearInterval(current_running_timer);
            current_running_timer = undefined;
        }
        show_result(current_data);
    }
}

var getReplyOfDoingFromJSON = undefined;
var getReplyOfDoingFromJSON4Zhan = undefined;
var getReplyOfDoingFromJSON4Page = undefined;

var parse_time = function(str) {
    var date = (new Date(str)).getTime() / 1000;
    str.replace(/([0-9]+)[ ]*秒(钟)?前/g, function(t, s) {
        date = (new Date()).getTime() / 1000 - parseInt(s);
    });
    str.replace(/([0-9]+)[ ]*分钟前/g, function(t, s) {
        date = (new Date()).getTime() / 1000 - parseInt(s) * 60;
    });
    str.replace(/([0-9]+)[ ]*小时前/g, function(t, s) {
        date = (new Date()).getTime() / 1000 - parseInt(s) * 3600;
    });
    str.replace(/今天[ ]*([0-9]+):([0-9]+)/g, function(t, s1, s2) {
        date = new Date();
        date.setHours(s1);
        date.setMinutes(s2);
        date.setSeconds(0);
        date = date.getTime() / 1000;
    });
    str.replace(/昨天[ ]*([0-9]+):([0-9]+)/g, function(t, s1, s2) {
        date = new Date();
        date.setHours(s1);
        date.setMinutes(s2);
        date.setSeconds(0);
        date = date.getTime() / 1000 - 86400;
    });
    return Math.round(date);
}
var current_select_user = undefined;

var do_select_user = function(uid) {
    if(current_select_user != undefined) current_select_user(uid);
    return false;
}
