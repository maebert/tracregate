function l(r) {console.log(r);}

NULL = NaN
var TRAC = [
    {
        url: 'ikw.uni-osnabrueck.de/trac/studentbody',
        name: 'Fachschaft',
        color: 221,
    },
    {
        url: 'ikw.uni-osnabrueck.de/trac/feelSpace',
        name: 'feelSpace',
        color: 323,
    },
    {
        url: 'ikw.uni-osnabrueck.de/trac/nbp',
        name: 'NBP',
        color: 117,
    }
]


jQuery(document).ready(function() {
    // check wheather we have a known user
    if (localStorage.hasOwnProperty("tracregator.version")) {
        var username = localStorage["tracregator.username"];
        var password = localStorage["tracregator.password"]; # VERY BAD PRACTICE!
        Tracregator.load(username, password);
        $("#modal_top").hide();
    }

    alignments();
});

function alignments() {
    $('#right').width($(window).width() - 432);
    $('div.vcenter').vAlign();
}


function login() {
    var my_username = $("#username").val();    
    var my_password = $("#password").val();
    $('#login').slideUp('slow');
    setTimeout(function() {auto_config(my_username, my_password)}, 1)
    return false;
}

function auto_config(user, pass) {
    $('#setup').slideDown('slow', alignments);
    for (var i in TRAC) {
        auto_config_single(user, pass, i);
    }
}

function auto_config_single(user, pass, index) {
    trac = TRAC[index];
    $('#autoconfig_list').append('<li id="autoconfig_'+index+'"><span class="trac" style="background-color: hsl('+trac.color+', 40%,85%); border-color: hsl('+trac.color+', 80%,40%); color: hsl('+trac.color+', 80%,40%);">'+trac.name+'</span> <span class="result"></span></li>');
    server = rpc("https://"+ user +":"+ pass +"@"+ trac.url + "/login/rpc", "xml", function (server) {auto_config_single_callback(server, index)} );
}

function auto_config_single_callback(server, index) {
    if (server == 404) {
        $('#autoconfig_'+index+' span.trac').addClass('disabled');
        $('#autoconfig_'+index+' span.result').html("[XML-RPC disabled.]");
        $('#autoconfig_'+index+' span.result').addClass('visible');
    } else {
        $('#autoconfig_'+index+' span.result').html("[OK]");
        $('#autoconfig_'+index).append("<div class='button dark' onClick='add_trac("+index+")'>Add</div>");
        $('#autoconfig_'+index+' span.result').addClass('visible');
        TRAC[index].server = server
    }    
}

function add_trac(index) {
    user = $("#username").val();
    pass = $("#password").val();
    Tracregator.add(TRAC[index].url, user, pass, TRAC[index].name, TRAC[index].color, TRAC[index].server);
    $('#autoconfig_'+index).hide('slow');
}

function finish_setup() {
    localStorage["tracregator.username"] = $("#username").val();
    localStorage["tracregator.version"] = Tracregator.version;    
    Tracregator.show_tickets(Tracregator.get_mine());
    $("#modal_top").fadeOut();
}


var Trac = function() {
    this.tickets = [];
    this.username = '';
    this.url = '';    
    this.login = function(username, password) {
        this.username = username;
        var me = this;
        rpc("https://"+ username +":"+password+"@"+this.url + "/login/rpc", "xml", function(server) {me.server = server; me.initialise()});
    }
    
    this.initialise = function() {
       var me = this;
       if (this.tickets.length == 0) 
           this.server.ticket.query(function(t) {me.parse_tickets(t)}, "status!=closed")
    }    
    
    this.parse_tickets = function(tickets) {
        wrapper = [];
        for (var n in tickets.result) {
            wrapper.push({
                'methodName': 'ticket.get',
                'params': [tickets.result[n]]
            });
        }
        var me = this;
        this.server.system.multicall(function(o) {
            for (var i in o.result) {
                ticket = o.result[i][0];
                ticket[3].id = ticket[0]; 
                ticket[3].trac = me; 
                me.tickets.push(ticket[3]);               
            }
            me.tracregator.save();        
        }, wrapper);
    }
        
    this.beautify_ticket = function(ticket) {
        if (ticket.hasOwnProperty('changes')) {
            new_changes = [];
            for (var n in ticket.changes) {
                change = ticket.changes[n];
                if (change.type == "cc") {
                    new_cc = []
                    rem_cc = []
                    o = change.old.split(", ")
                    n = change.comment.split(", ")
                    $.each(n, function (i, name) {if ($.inArray(name, o)<0) new_cc.push(name)});
                    if (change.old.length > 0)
                        $.each(o, function (i, name) {if ($.inArray(name, n)<0) rem_cc.push(name)});
                    result = ''
                    if (new_cc.length>0)
                        result += "<span class='author'>"+change.author + "</span> added "+this.tokenize(new_cc)+" to the CC."
                    if (new_cc.length>0 && rem_cc.length>0)
                        result += "<br />"
                    if (rem_cc.length>0)
                        result += "<span class='author'>"+change.author + "</span> removed "+this.tokenize(rem_cc)+" from the CC."
                    change.simple = result;
                    
                }
                
                function simple_change(change, action) {
                    comment = change.comment.length > 0 ? change.comment : "None";
                    if (change.old.length>0)
                        return "<span class='author'>"+change.author + "</span> "+action+" from "+change.old+" to "+comment+".";
                    else
                        return "<span class='author'>"+change.author + "</span> "+action+" to "+comment+".";
                }
                
                if (change.type == "priority")
                    change.simple = simple_change(change, "changed the priority");
                if (change.type == "severity")
                    change.simple = simple_change(change, "changed the severity");
                if (change.type == "component")
                    change.simple = simple_change(change, "moved the ticket");
                if (change.type == "status")
                    change.simple = simple_change(change, "changed the status");
                if (change.type == "milestone")
                    change.simple = simple_change(change, "changed the milestone");

                if (change.type == "description")
                    change.comment = "New Discription: "+change.comment
                if (change.type == "attachment")
                    change.simple = "<span class='author'>"+change.author + "</span> added the file '"+change.comment+"'.";
                
                if (!(change.type=="comment" && change.comment.length==0)) {
                    new_changes.push(change)
                }
            }
            ticket.changes = new_changes;
        }
    }
    
    this.load_ticket = function(ticket, callback) {
        var me = this;
        this.server.ticket.changeLog(function (t) {
            ticket.changes = t.result.map(function (change) {                
                return {
                    changetime: change[0],
                    author: change[1],
                    type: change[2],
                    old: change[3],
                    comment: change[4],
                }
            });
            me.beautify_ticket(ticket);
            ticket.changes.reverse();
            me.tracregator.save();
            callback();
        }, ticket.id)
    }

}



var Tracregate = function () {

    this.version = 0.1;
    this.tracs = [];
    
    this.save = function() {
        var trac_temps = Array();
        for (var i in this.tracs) {
            trac = this.tracs[i];
            trac_temps.push(  JSON.stringify({
                'id': i,
                'url': trac.url,
                'name': trac.name,
                'color': trac.color
            }));
            localStorage["tracregator.trac."+i] = JSON.stringify(trac.tickets, function(key, value) {
                if (key == "trac") 
                    return "";
                 else if (key == "changetime" || key == "time") {
                    return value;
                    }                    
                 else
                    return value;
            });
        }
        localStorage["tracregator.tracs"] = trac_temps.join(";");        
    }
    
    this.load = function (username, password) {
        var local_tracs = localStorage["tracregator.tracs"].split(";");
        for (var i in local_tracs) {
            var trac_data = JSON.parse(local_tracs[i]);
            trac = new Trac();
            trac.name = trac_data.name;
            trac.url = trac_data.url;
            trac.color = trac_data.color;
            trac.tracregator = this;
            trac.tokenize = this.tokenize;
            
            trac.tickets = JSON.parse(localStorage["tracregator.trac."+trac_data.id], function(key, value) { 
                if (key == "changetime" || key == "time") {
                    return value
                }
                else if (key == "trac")
                    return trac;
                else
                    return value;
            });
            this.tracs.push(trac)
            trac.login(username, password);
        }
        this.show_tickets(this.get_mine());
    
    }
    
    this.add = function(url, user, pass, name, color, server) {
        trac = new Trac();
        trac.name = name;
        trac.url = url;
        trac.tracregator = this;
        trac.color = color;
        trac.tokenize = this.tokenize;
        if (server != undefined) {
            trac.server = server;
            trac.initialise();
        } else {
            trac.login(user, pass);
        }
        
        this.tracs.push(trac);
    }
    
    this.get_mine = function() {
        var result = [];
        for (var j in this.tracs) {
            for (var i in this.tracs[j].tickets) {
                if (this.tracs[j].tickets[i].owner == this.tracs[j].tickets[i].trac.username) result.push(this.tracs[j].tickets[i]);
            }
        
        }
        result.sort(this.sort_by_date);
        return result;
    }
    
    this.sort_by_date = function(ticket_a, ticket_b) {
        a = new Date();
        b = new Date();
        a.setISO8601(ticket_a.changetime);
        b.setISO8601(ticket_b.changetime);
        return (a < b) ? 1 : -1;
    }
    
    this.show_tickets = function(tickets) {
        $("#tickets ul").empty();
        for (var n in tickets) {
            $("#tickets ul").append(this.ticket_list_template(tickets[n]));
        }
        $(".ellipsis").ellipsis();
    }
    
    this.reply = function(ticket, reply) {
        $('#reply_text').val('');
        $('#reply').toggle('fast');
        me = this;
        ticket.trac.server.ticket.update(function (response) {
            ticket.trac.load_ticket(ticket, function () {
                me.display_changes(ticket);
            });
        }, ticket.id, reply);
                
        return false;
    }
    
    this.display_ticket = function (ticket) {
        $('#display').empty();
        $('#display').append(this.ticket_template(ticket));
        var me = this;
        $('#reply_form').bind('submit', function() { return me.reply(ticket, $('#reply_text').val()); });
        
  	    if (!ticket.hasOwnProperty('changes')) {
  	         me = this;
	         ticket.trac.load_ticket(ticket, function () {me.display_changes(ticket);});
		} else {
		    this.display_changes(ticket);
		}
    }
    
    this.display_changes = function(ticket) {
        if (ticket.hasOwnProperty('changes')) {
            var container = $('#changes')
            container.empty();
            for (var n in ticket.changes) {
                change = ticket.changes[n];
                container.append(this.change_template(change));
            }
        }
    }
    
    this.ticket_list_template = function(ticket) {
        var short_time = jQuery.timeago(ticket.changetime);
        html = '<li>\n'
    	html += '<div class="date"><abbr title="'+ ticket.changetime +'">'+ short_time +'<abbr></div>';
    	html += '<div class="author">'+ ticket.owner +'</div>';
    	html += '<h2>' + ticket.summary + '</h2>';
    	html += '<summary class="ellipsis multiline">' + ticket.description + '</summary>';
    	html += '</li>\n';
    	element = $(html);
    	me = this;
    	element.bind('click', {ticket: ticket}, function (event) {
            $('#tickets ul li').removeClass('active')
            $(this).addClass('active')
            me.display_ticket(event.data.ticket);
        })
        return element;
    }
    
    this.tokenize = function(names) {
        if (typeof(names)=="string")        
            if (names.length>0)
                return names.split(", ").map(function (name) {return '<span class="token">'+name+'</span> '}).join("");
            else
                return ""
        else
            return names.map(function (name) {return '<span class="token">'+name+'</span> '}).join("");
           
    }
    
    this.ticket_template = function(ticket) {
		html =	'<div id="display_upper">';
		html +=	'<div class="button" onClick="$(\'#reply\').toggle(\'fast\');">&#8629;</div>\n';
		html +=	'<div class="button" onClick="$(\'#info\').toggle(\'fast\');">i</div>\n';
		html += '<h3><a href="https://'+ticket.trac.url+'/ticket/'+ticket.id+'" target="_blank">'+ ticket.summary +'</a></h3>';
		html += '<div id="info" style="display: none;"><ul>' +
		        '<li><span class="label">ID</span>'+ticket.trac.name+': '+ticket.id+'</li>' +
		        '<li><span class="label">Reporter</span>'+this.tokenize(ticket.reporter)+'</li>' +
		        '<li><span class="label">CC</span>'+this.tokenize(ticket.cc)+'</li>' +
		        '<li><span class="label">Component</span>'+ticket.component+'</li>' +
		        '<li><span class="label">Type</span>'+ticket.type+'</li>' +
		        '<li><span class="label">Status</span>'+ticket.status+'</li>' +
		        '<li><span class="label">Resolution</span>'+ticket.resolution+'</li>' +
		        '</ul></div>';
		html += '<div id="reply" style="display: none;"><form id="reply_form"><textarea id="reply_text"></textarea><br /><input type="submit" /><br style="clear:both;"></form></div>';
		html +=	'<summary>' + ticket.description + '</summary>';
		html +=	'</div><ul id="changes"></ul>';		
		return $(html);
    }
    
    this.change_template = function(change) {
        var short_time = jQuery.timeago(change.changetime);
        if (change.hasOwnProperty('simple')) {
    		html = "<li class='simplechange'>";
    		html += '<div class="date"><abbr title="'+change.changetime+'">'+ short_time +'<abbr></div>';
            html += '<div class="simple">'+ change.simple +'</div>';
            html += "</li>";
        } else {
    		html = "<li class='change' onClick=\"$('div.comment', this).toggle('fast');\">";
    		html += '<div class="date"><abbr title="'+change.changetime+'">'+ short_time +'<abbr></div>';
    		html += '<div class="author">'+ change.author +'</div>';
    		html += '<div class="summary">' + change.comment + '</div>';        
    		html += '<div class="comment" style="display:none;">' + change.comment + '</div>';        
            html += "</li>";
        }
        return $(html);
    }
    
}

var Tracregator = new Tracregate();



function submit_reply(ticket_id) {
    alert("Not implemented yet /8-(");
    return false;
}

$(window).resize(function() {
    alignments();
});


function load_menu() {
    $('li.navgroup').remove();
    for (var id=0; id<TRAC.length; id++) {
        trac = TRAC[id];
        var group = "<li class='navgroup'><div>"+trac.name+"</div><ul>\n";
        group += "<li onClick='load_tickets("+id+", QUERY_MINE, this);'>My Tasks</li>\n";
        group += "<li onClick='load_tickets("+id+", QUERY_OLD, this);'>Old Tasks</li>\n";
        group += "<li onClick='load_tickets("+id+", QUERY_ALL, this);'>All Tasks</li>\n";
        group += "</ul></li>\n";
        $('#menu').append(group);
    }
}



(function($) {
        $.fn.ellipsis = function()
        {
                return this.each(function()
                {
                        var el = $(this);

                        if(el.css("overflow") == "hidden")
                        {
                                var text = el.html();
                                var multiline = el.hasClass('multiline');
                                var t = $(this.cloneNode(true))
                                        .hide()
                                        .css('position', 'absolute')
                                        .css('overflow', 'visible')
                                        .width(multiline ? el.width() : 'auto')
                                        .height(multiline ? 'auto' : el.height())
                                        ;

                                el.after(t);

                                function height() { return t.height() > el.height(); };
                                function width() { return t.width() > el.width(); };

                                var func = multiline ? height : width;

                                while (text.length > 0 && func())
                                {
                                        text = text.substr(0, text.length - 1);
                                        t.html(text + "...");
                                }

                                el.html(t.html());
                                t.remove();
                        }
                });
        };
})(jQuery);
