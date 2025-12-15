import React, { useEffect, useRef, useState } from "react";
import { Button, IconButton, TextField } from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PhoneIcon from "@mui/icons-material/Phone";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import { CopyToClipboard } from "react-copy-to-clipboard-ts";
import Peer from "simple-peer";
import io from "socket.io-client";
import "./App.css";

// Socket.io connection (outside component)
const socket = io(import.meta.env.VITE_BACKEND_URL, {
  transports: ["websocket"],
});

function App() {
  const [me, setMe] = useState("");
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callerName, setCallerName] = useState("");

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  // STUN servers only
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  // 1️⃣ Get user media on load
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((currentStream) => setStream(currentStream))
      .catch((err) => {
        console.error("Media error:", err);
        alert("Please allow camera and microphone access!");
      });

    socket.on("connect", () => console.log("Socket connected:", socket.id));
    socket.on("me", (id) => setMe(id));

    socket.on("callUser", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerName(data.name);
      setCallerSignal(data.signal);
    });

    socket.on("callEnded", () => {
      setCallEnded(true);
      connectionRef.current?.destroy();
      window.location.reload();
    });

    return () => socket.off();
  }, []);

  // 2️⃣ Assign local video stream to <video> element
  useEffect(() => {
    if (myVideo.current && stream) {
      myVideo.current.srcObject = stream;
    }
  }, [stream]);

  // 3️⃣ Call a user
  const callUser = (id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: iceServers,
    });

    peer.on("signal", (data) =>
      socket.emit("callUser", { userToCall: id, signalData: data, from: me, name })
    );

    peer.on("stream", (currentStream) => {
      if (userVideo.current) userVideo.current.srcObject = currentStream;
    });

    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  // 4️⃣ Answer a call
  const answerCall = () => {
    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: iceServers,
    });

    peer.on("signal", (data) =>
      socket.emit("answerCall", { signal: data, to: caller })
    );

    peer.on("stream", (currentStream) => {
      if (userVideo.current) userVideo.current.srcObject = currentStream;
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  // 5️⃣ End call
  const leaveCall = () => {
    setCallEnded(true);
    connectionRef.current?.destroy();
    socket.emit("endCall", { to: caller || idToCall });
    window.location.reload();
  };

  // 6️⃣ Mute / Unmute
  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
      setIsMuted(!isMuted);
    }
  };

  // 7️⃣ Toggle video
  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="container">
      <div className="video-container">
        {/* Local video */}
        <div className="video">
          {stream ? (
            <video
              playsInline
              muted
              autoPlay
              ref={myVideo}
              style={{ width: "580px", transform: "scaleX(-1)" }}
            />
          ) : (
            <div style={{ width: "580px", height: "360px", background: "#000" }}>
              Loading camera...
            </div>
          )}
        </div>

        {/* Remote video */}
        <div className="video">
          {callAccepted && !callEnded && (
            <video
              playsInline
              autoPlay
              ref={userVideo}
              style={{ width: "580px" }}
            />
          )}
        </div>
      </div>

      <div className="myId">
        <TextField
          label="Name"
          variant="filled"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <CopyToClipboard text={me}>
          <Button variant="contained" color="primary" startIcon={<AssignmentIcon />}>
            Copy ID
          </Button>
        </CopyToClipboard>

        <TextField
          label="ID to call"
          variant="filled"
          value={idToCall}
          onChange={(e) => setIdToCall(e.target.value)}
        />

        {callAccepted && !callEnded ? (
          <Button variant="contained" color="secondary" onClick={leaveCall}>
            End Call
          </Button>
        ) : (
          <IconButton color="primary" onClick={() => callUser(idToCall)}>
            <PhoneIcon fontSize="large" />
          </IconButton>
        )}

        <div>
          <IconButton onClick={toggleMute}>{isMuted ? <MicOffIcon /> : <MicIcon />}</IconButton>
          <IconButton onClick={toggleVideo}>{isVideoOff ? <VideocamOffIcon /> : <VideocamIcon />}</IconButton>
        </div>
      </div>

      {receivingCall && !callAccepted && (
        <div className="caller">
          <h2>{callerName || "Someone"} is calling...</h2>
          <Button variant="contained" onClick={answerCall}>
            Answer
          </Button>
        </div>
      )}
    </div>
  );
}

export default App;
