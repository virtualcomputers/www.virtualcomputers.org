
function TermApp(term, id, pn)
{
    console.log("TermApp:", id);

    if (this == null || (!(this instanceof TermApp)))
    {
//	console.log("New");
	return new TermApp(term, id, pn);
    }

    this.term = term;
    this.id = id;
    this.pn = pn;
    this.buffer = "";
    this.pub_inprogress = false;
    this.pn_input = null;
    this.pn_output = null;
    this.termtype = null;
    this.width = -1;
    this.heigth = -1;
//    console.log("This:", this);
    return this;
}

TermApp.prototype._fetchjson = function (url, cb)
{
//    console.log("FetchJSON:", url);
    var req = new XMLHttpRequest();
    req.onreadystatechange = function()
	{
//	    console.log("XHR State:", req.readyState, "Status:", req.status);

	    if (req.readyState == 4 && req.status == 200)
	    {
		var js = null;

		try
		{
		    js = JSON.parse(req.responseText);
		}
		catch (e)
		{
		}

//		console.log("JS:", js);
		cb(js);
	    }
	};
    req.open("GET", url, true);
    req.send();

if (0)
    cb({
	 "id": 1,
	 "machine": 0,
	 "port": 1,
	 "description": "PDP-11/44 2.11BSD Console",
	 "display_chan": "FyzBH9sbBWLb",
	 "keyboard_chan": "6B9m8JyrYy0A",
	 "chat_chan": null
	});
};

TermApp.prototype.open = function (container, uuid, cb)
{
//    console.log("Open:", container, cb);
    this._fetchjson("/terminal/" + this.id, this._setup.bind(this, container, uuid, cb));
};

TermApp.prototype._get = function (obj, key, def)
{
    if (key in obj)
	return obj[key];

    return def;
};

TermApp.prototype._setup = function (container, uuid, cb, obj)
{
    var term = this.term;
    var pn = this.pn;

    this.description = this._get(obj, "description", null);
    this.pn_output = this._get(obj, "display_chan", null);
    this.pn_input = this._get(obj, "keyboard_chan", null);
    this.pn_chat = this._get(obj, "chat_chan", null);

    pn.subscribe(
	{
	    "channel": this.pn_output,
	    "uuid": uuid,
	    "message": this._message.bind(this)
	});

    var us = this;
    term.dom(container).on('readable', function () { us._read.call(us, this); });
    cb(this.description == null ? "Terminal" : this.description);
};

TermApp.prototype.close = function ()
{
    // disconnect from term object
    // unsubscribe from channel
};

TermApp.prototype.write = function (data)
{
    var term = this.term;
    term.write(data);
};

TermApp.prototype._publish = function (obj)
{
    var pn = this.pn;
    pn.publish(obj);
};

TermApp.prototype._message = function (message, env, ch, timer, magic_ch)
{
//    console.log("Message", message);
    this.write(message["d"]);
}

TermApp.prototype._read = function (term)
{
    this.buffer += term.read().toString();
    this._flush();
};

TermApp.prototype._pubdone = function ()
{
    this.pub_inprogress = false;
    this._flush();
};

TermApp.prototype._flush = function ()
{
    if (!this.pub_inprogress)
    {
	var buf = this.buffer;
	this.buffer = "";

	if (buf != "")
	{
	    this.pub_inprogress = true;
	    this._publish({
		channel: this.pn_input,
		message: { "d": buf },
		callback: this._pubdone.bind(this),
		error: this._pubdone.bind(this)
	    });
	}
    }
};
