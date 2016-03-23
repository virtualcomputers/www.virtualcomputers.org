
function button_click(button, id)
{
    if (button.value != "\u25B6")
    {
	button.value = "\u25B6";
	$( "#" + id ).hide();
    }
    else
    {
	button.value = "\u25BC";
	$( "#" + id ).show();
    }
}

function add_level(parentdiv, parentid, level, levels, items)
{
    var levelinfo = levels[level];
    var name = levelinfo["name"];
    var abrev = levelinfo["abrev"];
    var childfname = "-";
    var childabrev = "-";

    if (level + 1 < levels.length)
    {
	var childlevelinfo = levels[level + 1];
	childfname = childlevelinfo["name"];
	childabrev = childlevelinfo["abrev"];
    }

//    console.log("Level:", level, name, abrev, childfname, childabrev);

    // setup hidden attribute
//    var hidden = (levelinfo["hidden"]) ? " hidden" : "";

    var listid = parentid == "" ? "" : "-" + parentid;

    // Add list element
    $( "<div class=\"vc-" + abrev + "-list\" id=\"vc-" + abrev + "-list" + listid + "\"></div>" ).appendTo( parentdiv );

    var children = $( parentdiv ).children();
    var list = children[children.length - 1];
    var elem = 0;

//    console.log(abrev + "List:", list, levelinfo["hidden"]);

    if (levelinfo["hidden"])
	$( list ).hide();

    for (var i = 0; i < items.length; i++)
    {
	var item = items[i];
//	console.log(abrev + ":", i, childfname, item);
	var numchildren = childfname in item ? item[childfname].length : 0;
//	console.log("NumChildren:", numchildren);
	var itemid = parentid == "" ? "" : parentid + "-";

	var button = "<button class=\"vc-open-item-button-hidden\">&#x25B6;</button>";

	if (numchildren)
	    button = "<input type=\"button\" value=\"&#x25B6;\" class=\"vc-open-item-button\" id=\"vc-open-item-button-" + itemid + i + "\" onclick=\"button_click(this, 'vc-" + childabrev + "-list-" + itemid + i + "')\" />";

	var html = "<div class=\"vc-" + abrev + "-item\">\
	    <div class=\"vc-open-item\" id=\"vc-open-item-button-" + itemid + i + "-parent\">\
		" + button + "\
	    </div>\
	    <div class=\"vc-" + abrev + "-item-label\">\
		" + item["name"] + "\
	    </div>\
	</div>";

//	console.log("Html:", html);
	$( html ).appendTo( list );

	var divitem = $( list ).children()[elem++];
//	console.log(abrev + "Item:", divitem);

	if (numchildren)
	{
	    add_level(list, parentid == "" ? "" + i : parentid + "-" + i, level + 1, levels, item[childfname]);
	    elem++;
	}
    }
}

function setup_main_page()
{
//    console.log("MainPage");
    var maindiv = $( ".vc-main" );
//    console.log("MainDiv:", maindiv);

    if (maindiv.length < 1)
	return;

    var maindiv = maindiv[0];
//    console.log("MainDiv:", maindiv);

    var levels = [
	    {  name: "manufactures", abrev: "mfg" },
	    {  name: "architectures", abrev: "arch", hidden: true },
	    {  name: "models", abrev: "model", hidden: true },
	    {  name: "machines", abrev: "mach", hidden: true }
	];

    $.getJSON( "/manufacture?details=all", function( info ) {
//	    console.log("Info:", JSON.stringify(info, null, 4));
	    var nummfg = info.manufactures.length;
//	    console.log("NumMfg:", nummfg);

	    if (nummfg > 0)
		add_level(maindiv, "", 0, levels, info.manufactures);
	});
}

$( document ).ready(function () { setup_main_page(); });
