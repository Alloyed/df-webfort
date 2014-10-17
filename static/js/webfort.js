var colors = [32, 39, 49, 0, 106, 255, 68, 184, 57, 114, 156, 251, 212, 54, 85,
	176, 50, 255, 217, 118, 65, 170, 196, 178, 128, 151, 156, 48, 165, 255, 144,
	255, 79, 168, 212, 255, 255, 82, 82, 255, 107, 255, 255, 232, 102, 255, 250,
	232
];

var host;
if (document.location.hash) {
	host = document.location.hash.substr(1);
} else {
	host = document.location.hostname;
}
var wsUri = 'ws://' + host + ':1234/';
var active = false,
	lastqpos = -1;
var spectator = true;

function setStatus(text, color) {
	var st = document.getElementById('status');
	st.innerHTML = text;
	st.style.backgroundColor = color;
}

function connect() {
	websocket = new WebSocket(wsUri);
	websocket.binaryType = 'arraybuffer';

	websocket.onopen = onOpen;
	websocket.onclose = onClose;
	websocket.onmessage = onMessage;
	websocket.onerror = onError;
}

function fitCanvasToWindow() {
	if (active) {
		// FIXME: Canvas resizing meshes poorly with the chatbox.
		//canvas.width = window.innerWidth & (~15);
		//canvas.height = (window.innerHeight - 20) & (~15);


		var data = new Uint8Array([
				112,
				Math.floor(canvas.width / 16),
				Math.floor(canvas.height / 16)]);
		websocket.send(data);
	}
}

function onOpen(evt) {
	setStatus('Connected', 'orange');

	fitCanvasToWindow();
	websocket.send(new Uint8Array([115]));

	websocket.send(new Uint8Array([110]));
}

function onClose(evt) {
	setStatus('Disconnected', 'red');
}
function toggleSpectator()  {
	websocket.send(new Uint8Array([116]));
}
function renderQueueStatus(qpos, almostOver) {
	if (qpos === 0) {
		if (!active) {
			setStatus("You're in charge now!", 'green');
			active = true;
			lastqpos = -1;

			fitCanvasToWindow();
		} else if (almostOver) {
			setStatus("You're in charge now! Less than a minute left.", 'green');
		}
	} else {
		if (lastqpos !== qpos) {
			lastqpos = qpos;
			active = false;
			setStatus('Your position in the waiting queue is ' + qpos, 'orange');
		}
	}
}

function renderUpdate(ctx, data) {
	var t = [];
	for (var k = 4; k < data.length; k += 5) {
		var x = data[k + 0];
		var y = data[k + 1];

		var s = data[k + 2];
		var bg = data[k + 3] % 16;
		var fg = data[k + 4];

		var bg_x = ((bg % 4) * 256) + 15 * 16
		var bg_y = (Math.floor(bg / 4) * 256) + 15 * 16
		ctx.drawImage(cd, bg_x, bg_y, 16, 16, x * 16, y * 16, 16, 16);

		if (data[k + 3] & 64) {
			t.push(k);
			continue;
		}
		var fg_x = (s % 16) * 16 + ((fg % 4) * 256);
		var fg_y = Math.floor(s / 16) * 16 + (Math.floor(fg / 4) * 256);
		ctx.drawImage(cd, fg_x, fg_y, 16, 16, x * 16, y * 16, 16, 16);
	}

	for (var m = 0; m < t.length; m++) {
		var k = t[m];
		var x = data[k + 0];
		var y = data[k + 1];

		var s = data[k + 2];
		var bg = data[k + 3];
		var fg = data[k + 4];

		var i = (s % 16) * 16 + ((fg % 4) * 256);
		var j = Math.floor(s / 16) * 16 + (Math.floor(fg / 4) * 256);
		ctx.drawImage(ct, i, j, 16, 16, x * 16, y * 16, 16, 16);
	}
}

function onMessage(evt) {
	var data = new Uint8Array(evt.data);

	var ctx = canvas.getContext('2d');
	if (data[0] === 110) {
		stats.begin();

		var qpos = data[1] & 127;
		var soon = data[1] & 128;
		renderQueueStatus(qpos, soon);

		var neww = data[2] * 16;
		var newh = data[3] * 16;
		// resizeCanvas
		/*
		if (neww != canvas.width || newh != canvas.height) {
			canvas.width = neww;
			canvas.height = newh;
		}
		*/

		renderUpdate(ctx, data);

		stats.end();
	}
	else if (data[0] == 116) {
		spectator= (data[1]==1 ? true : false);
	}
	setTimeout(function() {
		websocket.send(new Uint8Array([110]));
	}, 1000 / 30);
}

function onError(ev) {
	console.log(ev);
	setStatus('Error', 'red');
}

function colorize(img, cnv) {
	var ctx3 = cnv.getContext('2d');

	for (var j = 0; j < 4; j++) {
		for (var i = 0; i < 4; i++) {
			var c = j * 4 + i;

			ctx3.drawImage(img, i * 256, j * 256);

			var idata = ctx3.getImageData(i * 256, j * 256, 256, 256);
			var pixels = idata.data;

			for (var u = 0, len = pixels.length; u < len; u += 4) {
				pixels[u] = pixels[u] * (colors[c * 3 + 0] / 255);
				pixels[u + 1] = pixels[u + 1] * (colors[c * 3 + 1] / 255);
				pixels[u + 2] = pixels[u + 2] * (colors[c * 3 + 2] / 255);
			}
			ctx3.putImageData(idata, i * 256, j * 256);

			ctx3.fillStyle = 'rgb(' +
					colors[c * 3 + 0] + ',' +
					colors[c * 3 + 1] + ',' +
					colors[c * 3 + 2] + ')';

			ctx3.fillRect(i * 256 + 16 * 15, j * 256 + 16 * 15, 16, 16);

		}
	}
}

function init() {
	if (!l1 || !l2)
		return;

	cd = document.createElement('canvas');
	cd.width = cd.height = 1024;
	colorize(ts, cd);

	ct = document.createElement('canvas');
	ct.width = ct.height = 1024;
	colorize(tt, ct);

	setStatus('Connecting...', 'orange');
	connect();
}

var stats = new Stats();
document.body.appendChild(stats.domElement);
stats.domElement.style.position = "absolute";
stats.domElement.style.top = "0px";

var l1 = false;
var ts = document.createElement('img');
ts.src = 'Spacefox_16x16.png';

var l2 = false;
var tt = document.createElement('img');
tt.src = 'ShizzleClean.png';

var cd, ct;

ts.onload = function() {
	l1 = true;
	init();
};
tt.onload = function() {
	l2 = true;
	init();
};

var canvas = document.getElementById('myCanvas');

document.onkeydown = function(ev) {
	if (!active)
		return;

	if (ev.keyCode === 91 ||
			ev.keyCode === 18 ||
			ev.keyCode === 17 ||
			ev.keyCode === 16) {
		return;
	}

	if (ev.keyCode < 65) {
		var mod = (ev.shiftKey << 1) | (ev.ctrlKey << 2) | ev.altKey;
		var data = new Uint8Array([111, ev.keyCode, 0, mod]);
		websocket.send(data);
		ev.preventDefault();
	} else {
		lastKeyCode = ev.keyCode;
	}
};

document.onkeypress = function(ev) {
	if (!active)
		return;

	var mod = (ev.shiftKey << 1) | (ev.ctrlKey << 2) | ev.altKey;
	var data = new Uint8Array([111, 0, ev.charCode, mod]);
	websocket.send(data);

	ev.preventDefault();
};

window.onresize = fitCanvasToWindow;
