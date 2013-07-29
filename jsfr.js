// Javascript implementation of the Fruchterman Reingold Algorithm.
// By Donghao.Ren
// References:
//  Fruchterman, T. M. J., & Reingold, E. M. (1991). Graph Drawing by Force-Directed Placement. Software: Practice and Experience, 21(11).

// Nodes:
//   n      : number of nodes, identified with 0 to N - 1
//   edges  : [[v1, v2], ...]
//   params : { attraction = 0.75, repulsion = 0.75, max_iterations = 800, size = 1 }
var jsfr_initialize = function(n,edges,params) {
    // Load parameters.
    var size = 100;
    var speed = 1;
    var gravity = 10;
    if(params != undefined) {
        if(params.size != undefined) size = params.size;
        if(params.speed != undefined) speed = params.speed;
        if(params.gravity != undefined) gravity = params.gravity;
    }
    var area = size * size;
    var AREA_MULTIPLICATOR = 10000;
    var SPEED_DIVISOR = 800;
    // Initialize.
    //var temperature = size / 10;
    var epsilon = 0.000001;
    var nodes = new Array();
    // Node: x y dx dy degree
    if(params != undefined && params.nodes != undefined) {
        // Load initial position.
        for(var i = 0; i < n; i++) {
            nodes.push([params.nodes[i][0], params.nodes[i][1], 0, 0, 0, params.nodes[i][2]]);
        }
    } else {
        // Random positions.
        for(var i = 0; i < n; i++) {
            // px, py, vx, vy.
            nodes.push([ Math.random() * size, Math.random() * size, 0, 0, 0, 0 ]);
        }
    }
    // Calculate degrees.
    for(var e = 0; e < edges.length; e++) {
        nodes[edges[e][0]][4]++;
        nodes[edges[e][1]][4]++;
    }
    var max_displace = Math.sqrt(AREA_MULTIPLICATOR * area) / 10.0;
    var k = Math.sqrt(AREA_MULTIPLICATOR * area) / (1 + n);
    
    var context = {
        size: size, speed: speed, gravity: gravity,
        area: area,
        AREA_MULTIPLICATOR: AREA_MULTIPLICATOR,
        SPEED_DIVISOR: SPEED_DIVISOR,
        epsilon: epsilon,
        nodes: nodes,
        iterate : function() {
            var size = this.size;
            var speed = this.speed;
            var gravity = this.gravity;
            var area = this.area;
            var f = this.f;
            var AREA_MULTIPLICATOR = this.AREA_MULTIPLICATOR;
            var SPEED_DIVISOR = this.SPEED_DIVISOR;
            var epsilon = this.epsilon;
            var nodes = this.nodes;
            // Cleanup forces.
            for(var i = 0; i < n; i++) {
                nodes[i][2] = 0;
                nodes[i][3] = 0;
            }
            // Calculate repulsive forces. -- Perform a optimization.
            for(var i = 0; i < n; i++) {
                for(var j = 0; j < n; j++) {
                    if(i == j) continue;
                    var dx = nodes[i][0] - nodes[j][0];
                    var dy = nodes[i][1] - nodes[j][1];
                    var d = Math.sqrt(dx * dx + dy * dy);
                    if(d < epsilon) d = epsilon;
                    var f = k * k / d;
                    nodes[i][2] += dx / d * f;
                    nodes[i][3] += dy / d * f;
                }
            }
            // Calculate attractive forces.
            for(var e = 0; e < edges.length; e++) {
                var i = edges[e][0];
                var j = edges[e][1];
                var dx = nodes[i][0] - nodes[j][0];
                var dy = nodes[i][1] - nodes[j][1];
                var d = Math.sqrt(dx * dx + dy * dy);
                if(d < epsilon) d = epsilon;
                var f = d * d / k;
                if(edges[e].length >= 3) f *= edges[e][2];
                dx = (dx / d) * f;
                dy = (dy / d) * f;
                nodes[i][2] -= dx;
                nodes[i][3] -= dy;
                nodes[j][2] += dx;
                nodes[j][3] += dy;
            }
            // Gravity
            for(var i = 0; i < n; i++) {
                var dx = nodes[i][0];
                var dy = nodes[i][1];
                var d = Math.sqrt(dx * dx + dy * dy);
                if(d < epsilon) d = epsilon;
                var f = 0.01 * k * gravity * d;
                nodes[i][2] -= dx / d * f;
                nodes[i][3] -= dy / d * f;
            }
            for(var i = 0; i < n; i++) {
                nodes[i][2] *= speed / SPEED_DIVISOR;
                nodes[i][3] *= speed / SPEED_DIVISOR;
            }
            // Update positions.
            for(var i = 0; i < n; i++) {
                if(nodes[i][5]) continue;
                var vx = nodes[i][2];
                var vy = nodes[i][3];
                var d = Math.sqrt(vx * vx + vy * vy);
                if(d < epsilon) d = epsilon;
                var dl = Math.min(max_displace * (speed / SPEED_DIVISOR), d);
                var dx = vx / d * dl;
                var dy = vy / d * dl;
                var nx = nodes[i][0] + dx;
                var ny = nodes[i][1] + dy;
                nodes[i][0] = nx;
                nodes[i][1] = ny;
            }
        }
    };
    return context;
};

var jsfr_run = function(n,edges,params) {
    ctx = jsfr_initialize(n, edges, params);
    for(var i = 0; i < n * 2; i++) ctx.iterate();
    return ctx.nodes;
};