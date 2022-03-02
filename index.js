const { WAConnection, MessageType } = require("@adiwajshing/baileys")
const fs = require("fs")
const http = require("http")
const qrcode = require("qrcode")
const express = require("express")
const socketIO = require("socket.io")


const { phoneNumberFormatter } = require('./helper/formatter');

const port = 80
const app = express()
const server = http.createServer(app)
const io = socketIO(server)
const wa = new WAConnection()
wa.version = [2, 2204, 13]

wa.connectOptions.alwaysUseTakeover = false

io.on("connection", async socket => {
	socket.emit("log", "Connecting...")

	wa.on("qr", qr => {
		qrcode.toDataURL(qr, (err, url) => {
			socket.emit("qr", url)
			socket.emit("log", "QR Code received, please scan!")
		})
	})

	wa.on("open", res => {
		socket.emit("qrstatus", "./assets/check.svg")
		socket.emit("log", "WhatsApp terhubung!")
		socket.emit("log", res)
		const authInfo = wa.base64EncodedAuthInfo()
    		fs.writeFileSync('./auth_info.json', JSON.stringify(authInfo, null, '\t'))
	})

	wa.on("close", res => {
		socket.emit("log", "WhatsApp terputus!")
		socket.emit("log", res)
	})

	switch (wa.state) {
		case "close":
			await wa.connect()
			break
		case "open":
			socket.emit("qrstatus", "./assets/check.svg")
			socket.emit("log", "WhatsApp terhubung!")
			break
		default:
			socket.emit("log", wa.state)
	}
})

app.use(express.json())
app.use(express.urlencoded({
  extended: true
}))
app.use("/assets", express.static(__dirname + "/client/assets"))

app.get("/", (req, res) => {
	res.sendFile("./client/wask.html", {
		root: __dirname
	})
})

//----------------------------------------------------------------------------------
//Kirim Pesan
app.get("/kirim-pesan", (req, res) => {
	res.sendFile("./client/kirimpesan.html", {
		root: __dirname
	})
})


app.post('/kirim-pesan', async (req, res) => {
const message = req.body.message
const number = req.body.number
	if (wa.state === "open") {
		const exists = await wa.isOnWhatsApp(phoneNumberFormatter(number))
		if (exists) {
			wa.sendMessage(exists.jid, message, MessageType.text)
				.then(result => {
					res.status(200).json({
						status: true,
						response: result
					})
				})
				.catch(err => {
					res.status(500).json({
						status: false,
						response: err
					})
				})
			} else {
			res.status(500).json({
				status: false,
				response: `Nomor ${number} tidak terdaftar.`
			})
		}
	} else {
		res.status(500).json({
			status: false,
			response: `WhatsApp belum terhubung.`
		})
	}
	res.redirect('/kirim-pesan');
})

//----------------------------------------------------------------------------------

//y----------------------------------------------------------------------------------
//Broadcast

app.get("/broadcast", (req, res) => {
	res.sendFile("./client/broadcast.html", {
		root: __dirname
	})
})

app.post("/broadcast", async (req, res) => {
	const message = req.body.message
	anu = await wa.chats.all()
	for (let _ of anu) {
		wa.sendMessage(_.jid, `${message}`, MessageType.text).then(response => {
			res.status(200).json({
				status: true,
				response: response
			});
		}).catch(err => {	
			res.status(500).json({
				status: false,
				response: err
			});
		});
	}
	res.redirect("/broadcast")
});

//----------------------------------------------------------------------------------

server.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`)
})
