import React, { useState, useRef, useEffect } from "react";

// PUBLIC_INTERFACE
function ChatPage() {
  /**
   * Renders the Chat Page containing the AI travel chatbot.
   * Allows user to enter queries and get AI responses in a conversational UI.
   */
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Hi there! 👋 I'm your AI travel assistant. How can I help plan your trip today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
  e.preventDefault();
  if (!input.trim()) return;

  const userText = input.trim();
  setMessages((prev) => [...prev, { sender: "user", text: userText }]);
  setInput("");
  setWaiting(true);

  try {
    const API_URL ='https://api.cohere.ai/v1/chat' 
    //process.env.REACT_APP_CHAT_API_URL;
    const API_KEY = 'xyV9r163fmM8ieMhIFAUbmymr6DakgKJ8wj520lv'
    //process.env.REACT_APP_CHAT_API_KEY;

    //console.log("🔧 API URL:", API_URL);
    //console.log("🔐 API KEY:", API_KEY ? "Loaded ✅" : "Missing ❌");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        message: userText,
        model: "command-r-plus", // or "command-r" depending on your plan
        temperature: 0.7,
        chat_history: messages.map((msg) => ({
          role: msg.sender === "user" ? "USER" : "CHATBOT",
          message: msg.text,
        })),
      }),
  });

    if (!response.ok) {
      const err = await response.text();
      console.error("❌ API Error:", response.status, err);
      setMessages((prev) => [
      ...prev,
      { sender: "ai", text: `Error: ${err || 'Unknown issue occurred with the AI API.'}` },
]);
      //throw new Error("API request failed");
    }

    const data = await response.json();
    console.log("✅ API Response:", data);
    const aiReply = data.text || "Sorry, no useful answer returned.";
    setMessages((prev) => [...prev, { sender: "ai", text: aiReply }]);
  } catch (error) {
    console.error("⚠️ Chat API Error:", error);
    setMessages((prev) => [
      ...prev,
      { sender: "ai", text: "Oops! Something went wrong. Please try again later." },
    ]);
  }

  setWaiting(false);
}


  //function getDemoAIReply(text) {
   // if (/bali|iceland|paris/i.test(text))
     // return `Great choice! Here are some top things to do in ${text.match(/bali|iceland|paris/i)[0].charAt(0).toUpperCase() + text.match(/bali|iceland|paris/i)[0].slice(1)}:\n• Explore local culture\n• Try local cuisine\n• Visit must-see attractions!`;
    //if (/pack|packing/i.test(text))
     // return "When packing for your trip, consider the climate and activities: bring layers, comfy shoes, and don't forget essential documents!";
    //if (/hello|hi|hey/i.test(text)) return "Hello! How can I assist you with your travel plans?";
    //return "That's an excellent question! Let me look up the best answer for you. 🌏";
  //}

  return (
    <div>
      <div className="title" style={{ fontSize: '2rem', marginBottom: 10, color: "#1E90FF" }}>
        AI Travel Chatbot
      </div>
      <div className="description" style={{ maxWidth: 600, marginBottom: 22 }}>
        Ask any travel question and get instant answers, tips, recommendations, and planning help!
      </div>
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(30,144,255,0.10)",
          padding: 0,
          maxWidth: 500,
          margin: "0 auto 12px auto",
          minHeight: 340,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Chat transcript */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 18px",
          background: "#F6F9FF",
          minHeight: 220,
        }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
                marginBottom: 13,
              }}
            >
              {msg.sender === "ai" && (
                <div
                  style={{
                    width: 30,
                    height: 30,
                    background: "#1E90FF",
                    borderRadius: "50%",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                  title="TravelGenie AI"
                >
                  🤖
                </div>
              )}
              <div
                style={{
                  background: msg.sender === "user" ? "#1E90FF" : "#fff",
                  color: msg.sender === "user" ? "#fff" : "#1A1A1A",
                  borderRadius: 16,
                  padding: "9px 16px",
                  maxWidth: 320,
                  whiteSpace: "pre-line",
                  fontSize: "1.09rem",
                  boxShadow: msg.sender === "ai" ? "0 2px 4px rgba(30,144,255,0.07)" : "0 2px 4px rgba(30,144,255,0.15)",
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start"
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>
        {/* Input */}
        <form onSubmit={sendMessage} style={{
          display: "flex",
          gap: 12,
          padding: "12px 14px",
          borderTop: "1px solid #B3D5FF",
          background: "#fff"
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={waiting}
            className="input"
            style={{
              flex: 1,
              padding: "10px 15px",
              border: "1px solid #B3D5FF",
              borderRadius: 5,
              fontSize: "1.08rem"
            }}
            placeholder="Ask me anything about your trip…"
            autoFocus
            aria-label="Chat input"
          />
          <button
            className="btn"
            type="submit"
            disabled={waiting || !input.trim()}
            style={{
              background: "#FFB300",
              color: "#fff",
              fontWeight: 600,
              minWidth: 80,
              fontSize: "1.08rem"
            }}
            aria-label="Send"
          >
            {waiting ? "..." : "Send"}
          </button>
        </form>
      </div>
      <div style={{ textAlign: "center", color: "#888", fontSize: "0.97rem" }}>
        Your fun travel assistant is here 24/7! <span role="img" aria-label="earth">🌍</span>
      </div>
    </div>
  );
}

export default ChatPage;
