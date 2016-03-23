

var pg = require('pg');
var express = require('express');
var app = express();

var connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/term';
var client = new pg.Client(connectionString);
client.connect();

function error_json(status, msg)
{
    return { "error": true, "status": status, "msg": msg };
}

function compare_row_x(row1, row2)
{
    if (row1["mfgid"] != row2["mfgid"])
	return row1["mfgname"].localeCompare(row2["mfgname"]);

    var onehas = "archid" in row1;
    var twohas = "archid" in row2;

    if (onehas && twohas)
    {
	if (row1["archid"] != row2["archid"])
	    return row1["archname"].localeCompare(row2["archname"]);

	onehas = "modelid" in row1;
	twohas = "modelid" in row2;

	if (onehas && twohas)
	{
	    if (row1["modelid"] != row2["modelid"])
		return row1["modelname"].localeCompare(row2["modelname"]);

	    onehas = "machineid" in row1;
	    twohas = "machineid" in row2;

	    if (onehas && twohas)
	    {
		if (row1["machineid"] != row2["machineid"])
		    return row1["machinename"].localeCompare(row2["machinename"]);

		return 0;
	    }
	}
    }

    if (onehas)
	return 1;

    if (twohas)
	return -1;

    return 0;
}

function compare_row(row1, row2)
{
    var x = compare_row_x(row1, row2);
//    console.log("Compare:", row1, row2, "->", x);
    return x;
}

function format_reply(rows)
{
    var reply = { "manufactures": [] };
    var lastmfgid = -1;
    var lastarchid = -1;
    var lastmodelid = -1;
    var lastmachineid = -1;
    var mfgindex = -1;
    var archindex = -1;
    var modelindex = -1;
    var machineindex = -1;
    var numrows = rows.length;

    if (numrows == 0)
	return reply;

    var rowpos = [ ];

    for (var i = 0; i < numrows; i++)
	rowpos[i] = 0;

//    console.log("Result1:", rows1);
//    console.log("Result2:", rows2);

    while (true)
    {
	var info = null;
	var n = -1;

	for (var j = 0; j < numrows; j++)
	{
	    var p = rowpos[j];
	    var r = rows[j];
	    var e = r[p];

	    if (p < r.length)
	    {
		if (info == null)
		{
		    info = e;
		    n = j;
		}
		else if (compare_row(info, e) > 0)
		{
		    info = e;
		    n = j;
		}
	    }
	}

	if (info == null || n < 0)
	    break;

	rowpos[n]++;

	if (lastmfgid != info["mfgid"])
	{
	    mfgindex++;
	    lastmfgid = info["mfgid"];
	    lastarchid = -1;
	    archindex = -1;
	    reply["manufactures"][mfgindex] = { "id": info["mfgid"], "name": info["mfgname"], "description": info["mfgdesc"], "architectures": [] };
//	    console.log("Add Mfg:", mfgindex, info["mfgname"]);
	}

	if ("archid" in info && lastarchid != info["archid"])
	{
	    archindex++;
	    lastarchid = info["archid"];
	    lastmodelid = -1;
	    modelindex = -1;
	    reply["manufactures"][mfgindex]["architectures"][archindex] = { "id": info["archid"], "name": info["archname"], "description": info["archdesc"], "models": [] };
//	    console.log("Add Arch:", archindex, info["archname"]);
	}

	if ("modelid" in info && lastmodelid != info["modelid"])
	{
	    modelindex++;
	    lastmodelid = info["modelid"];
	    lastmachineid = -1;
	    machineindex = -1;
	    reply["manufactures"][mfgindex]["architectures"][archindex]["models"][modelindex] = { "id": info["modelid"], "name": info["modelname"], "description": info["modeldesc"], "machines": [] };
//	    console.log("Add Model:", modelindex, info["modelname"]);
	}

	if ("machineid" in info && lastmachineid != info["machineid"])
	{
	    machineindex++;
	    lastmachineid = info["machineid"];
	    reply["manufactures"][mfgindex]["architectures"][archindex]["models"][modelindex]["machines"][machineindex] = { "id": info["machineid"], "name": info["machinename"], "description": info["machinedesc"] };
//	    console.log("Add Machine:", machineindex, info["machinename"]);
	}

//	console.log("Reply:", i, JSON.stringify(reply, null, 4));
    }

//    console.log("Final reply:", JSON.stringify(reply, null, 4));
    return reply
}

function doquerystep(num, steps, resp, cb)
{
    while (num < steps.length && steps[num] == null)
	num++;

    if (num < steps.length)
    {
	// Run step number num
	var query = client.query(steps[num], function (err, result) {
		if (err)
		    cb(err, error_json(500, "Database error"));
		else
		{
		    resp[resp.length] = result.rows;
		    doquerystep(num + 1, steps, resp, cb);
		}
	    });

	return;
    }

//    console.log("query done:", resp);
    var reply = format_reply(resp);
//    console.log("query reply:", JSON.stringify(reply, null, 4));
    cb(0, format_reply(resp));
}

function querysteps(steps, cb)
{
    doquerystep(0, steps, [], cb);
}

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function(req, res) {
	res.send('hello world');
    });

app.get('/manufacture', function (req, res) {
	if ("details" in req.query && req.query.details == "all")
	{
	    var cmd1 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc from manufacture mfg order by mfg.name;'
	    var cmd2 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc from architecture a, manufacture mfg where a.manuf = mfg.id order by mfg.name, a.name;'
	    var cmd3 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc from model md, architecture a, manufacture mfg where md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name;'
	    var cmd4 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc, m.id as machineid, m.name as machinename, m.description as machinedesc from machine m, model md, architecture a, manufacture mfg where m.model = md.id and md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name, m.name;'
	    querysteps([cmd1, cmd2, cmd3, cmd4], function (err, result) {
		    res.json(result);
		});
	    return;
	}

	var cmd1 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc from manufacture mfg order by mfg.name;'
	var cmd2 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc from architecture a, manufacture mfg where a.manuf = mfg.id order by mfg.name, a.name;'
	querysteps([cmd1, cmd2], function (err, result) {
		res.json(result);
	    });
    });

app.get('/manufacture/:manufactureid', function (req, res) {
	var manufactureid = req.params.manufactureid;
	var cmd1 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc from manufacture mfg where mfg.id = ' + manufactureid + ' order by mfg.name;'
	var cmd2 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc from architecture a, manufacture mfg where mfg.id = ' + manufactureid + ' and a.manuf = mfg.id order by mfg.name, a.name;'
	querysteps([cmd1, cmd2], function (err, result) {
		res.json(result);
	    });
    });

app.get('/architecture', function (req, res) {
	var cmd1 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc from architecture a, manufacture mfg where a.manuf = mfg.id order by mfg.name, a.name;'
	var cmd2 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc from model md, architecture a, manufacture mfg where md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name;'
	querysteps([cmd1, cmd2], function (err, result) {
		res.json(result);
	    });
    });

app.get('/architecture/:architectureid', function (req, res) {
	var architectureid = req.params.architectureid;
	var cmd1 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc from architecture a, manufacture mfg where a.id = ' + architectureid + ' and a.manuf = mfg.id order by mfg.name, a.name;'
	var cmd2 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc from model md, architecture a, manufacture mfg where a.id = ' + architectureid + ' and md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name;'
	querysteps([cmd1, cmd2], function (err, result) {
		res.json(result);
	    });
    });

app.get('/model', function (req, res) {
	var cmd1 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc from model md, architecture a, manufacture mfg where md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name;'
	var cmd2 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc, m.id as machineid, m.name as machinename, m.description as machinedesc from machine m, model md, architecture a, manufacture mfg where m.model = md.id and md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name, m.name;'
	querysteps([cmd1, cmd2], function (err, result) {
		res.json(result);
	    });
    });

app.get('/model/:modelid', function (req, res) {
	var modelid = req.params.modelid;
	var cmd1 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc from model md, architecture a, manufacture mfg where md.id = ' + modelid + ' and md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name;'
	var cmd2 = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc, m.id as machineid, m.name as machinename, m.description as machinedesc from machine m, model md, architecture a, manufacture mfg where md.id = ' + modelid + ' and m.model = md.id and md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name, m.name;'
	querysteps([cmd1, cmd2], function (err, result) {
		res.json(result);
	    });
    });

app.get('/machine', function (req, res) {
	var cmd = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc, m.id as machineid, m.name as machinename, m.description as machinedesc from machine m, model md, architecture a, manufacture mfg where m.model = md.id and md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name, m.name;'
	querysteps([cmd], function (err, result) {
		res.json(result);
	    });
    });

app.get('/machine/:machineid', function (req, res) {
	var machineid = req.params.machineid;
	var cmd = 'select mfg.id as mfgid, mfg.name as mfgname, mfg.description as mfgdesc, a.id as archid, a.name as archname, a.description as archdesc, md.id as modelid, md.name as modelname, md.description as modeldesc, m.id as machineid, m.name as machinename, m.description as machinedesc from machine m, model md, architecture a, manufacture mfg where m.id = ' + machineid + ' and m.model = md.id and md.architecture = a.id and a.manuf = mfg.id order by mfg.name, a.name, md.name, m.name;'
	querysteps([cmd], function (err, result) {
		res.json(result);
	    });
    });

app.get('/terminal/:terminalid', function (req, res) {
	var terminalid = req.params.terminalid;
	var cmd = "select * from terminal where id = " + terminalid + ";";
	var query = client.query(cmd, function (err, result) {
//		console.log("Result:", result);
		if (err)
		    res.json(error_json(500, "Database error"));
		else if (result.rows.length > 0)
		    res.json(result.rows[0]);
		else
		    res.json(error_json(404, "Terminal not found"));
	    });

	return;
    });

app.use(express.static('ui'));
app.use('/term', express.static('term'));
app.use('/fonts', express.static('fonts'));
app.use('/term/node_modules', express.static('node_modules'));

app.listen(3000);
