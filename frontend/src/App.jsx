import React, { useEffect, useRef, useState } from "react"
import { Button, IconButton, TextField } from "@mui/material"
import AssignmentIcon from "@mui/icons-material/Assignment"
import PhoneIcon from "@mui/icons-material/Phone"
import MicIcon from "@mui/icons-material/Mic"
import MicOffIcon from "@mui/icons-material/MicOff"
import VideocamIcon from "@mui/icons-material/Videocam"
import VideocamOffIcon from "@mui/icons-material/VideocamOff"
import { CopyToClipboard } from "react-copy-to-clipboard-ts"
import Peer from "simple-peer/simplepeer.min.js"
import io from "socket.io-client"
import "./App.css"

const socket = io.connect("http://localhost:5000")

function App() {
  const [me, setMe] = useState("")
  const [stream, setStream] = useState()
  const [receivingCall, setReceivingCall] = useState(false)
  const [caller, setCaller] = useState("")
  const [callerSignal, setCallerSignal] = useState()
  const [callAccepted, setCallAccepted] = useState(false)
  const [idToCall, setIdToCall] = useState("")
  const [callEnded, setCallEnded] = useState(false)
  const [name, setName] = useState("")
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [callerName, setCallerName] = useState("")


  const myVideo = useRef()
  const userVideo = useRef()
  const connectionRef = useRef()

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setStream(stream)
        if (myVideo.current) {
          myVideo.current.srcObject = stream
        }
      })
      .catch((err) => {
        console.error("Failed to get camera/mic access:", err)
        alert("Camera and microphone permission are required for this app. Please enable them.")
      })

    socket.on("me", (id) => {
      setMe(id)
    })

    socket.on("callUser", (data) => {
      setReceivingCall(true)
      setCaller(data.from)
      setCallerName(data.name)
      setCallerSignal(data.signal)
    })
    
    socket.on("callEnded", () => {
    alert("The other user ended the call.")
    setCallEnded(true)
    connectionRef.current?.destroy()
    window.location.reload()
  })
  }, [])

  const callUser = (id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    })

    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
        name: name,
      })
    })

    peer.on("stream", (stream) => {
      userVideo.current.srcObject = stream
    })

    socket.on("callAccepted", (signal) => {
      setCallAccepted(true)
      peer.signal(signal)
    })

    connectionRef.current = peer
  }

  const answerCall = () => {
    setCallAccepted(true)
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    })

    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller })
    })

    peer.on("stream", (stream) => {
      userVideo.current.srcObject = stream
    })

    peer.signal(callerSignal)
    connectionRef.current = peer
  }

  const leaveCall = () => {
    setCallEnded(true)
    connectionRef.current?.destroy()
    socket.emit("endCall", { to: caller || idToCall }) // 👈 notify the other peer
    window.location.reload()
  }

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsMuted((prev) => !prev)
    }
  }

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsVideoOff((prev) => !prev)
    }
  }

  return (
    <>
      <div className="container">
        <div className="video-container">
          <div className="video">
            {stream && (
              <video
                playsInline
                muted
                ref={myVideo}
                autoPlay
                style={{
                         width: "580px",
                         transform: "scaleX(-1)", // Un-mirror local video
                 }}
              />
            )}
          </div>
          <div className="video">
            {callAccepted && !callEnded ? (
              <video
                playsInline
                ref={userVideo}
                autoPlay
                style={{
                         width: "580px",
                         transform: "scaleX(-1)", // Un-mirror local video
                 }}
              />
            ) : null}
          </div>
        </div>

        <div className="myId">
          <TextField
            id="filled-basic"
            label="Name"
            variant="filled"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: "20px" }}
          />

          <CopyToClipboard text={me} style={{ marginBottom: "2rem" }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AssignmentIcon fontSize="large" />}
            >
              Copy ID
            </Button>
          </CopyToClipboard>

          <TextField
            id="filled-basic"
            label="ID to call"
            variant="filled"
            value={idToCall}
            onChange={(e) => setIdToCall(e.target.value)}
          />

          {/* Call + Control Buttons */}
          <div className="call-button">
            {callAccepted && !callEnded ? (
              <Button variant="contained" color="secondary" onClick={leaveCall}>
                End Call
              </Button>
            ) : (
              <IconButton
                color="primary"
                aria-label="call"
                onClick={() => callUser(idToCall)}
              >
                <PhoneIcon fontSize="large" />
              </IconButton>
            )}

            {/* Mic + Video Controls */}
            <div style={{ marginTop: "1rem" }}>
              <IconButton
                color={isMuted ? "error" : "primary"}
                onClick={toggleMute}
                style={{ marginRight: "1rem" }}
              >
                {isMuted ? (
                  <MicOffIcon fontSize="large" />
                ) : (
                  <MicIcon fontSize="large" />
                )}
              </IconButton>

              <IconButton
                color={isVideoOff ? "error" : "primary"}
                onClick={toggleVideo}
              >
                {isVideoOff ? (
                  <VideocamOffIcon fontSize="large" />
                ) : (
                  <VideocamIcon fontSize="large" />
                )}
              </IconButton>
            </div>
          </div>
        </div>

        {/* Incoming call notification */}
        <div>
          {receivingCall && !callAccepted ? (
            <div className="caller">
              <h1>{callerName || "Someone"} is calling...</h1>
              <Button variant="contained" color="primary" onClick={answerCall}>
                Answer
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

export default App
