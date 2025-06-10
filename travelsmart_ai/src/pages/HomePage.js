import React from "react";
import { Link } from "react-router-dom";

// PUBLIC_INTERFACE
function HomePage() {
  /**
   * Renders the Home Page of the TravelGenie app.
   * Includes app introduction and navigation links.
   */
  return (
    <div className="hero" style={{ minHeight: "68vh" }}>
      <div className="title" style={{ color: "#1E90FF" }}>
        Welcome to TravelGenie!
      </div>
      <div className="subtitle">
        Your all-in-one AI-powered travel planner.
      </div>
      <div className="description" style={{ marginBottom: 32 }}>
        Plan smarter, travel easier: generate personalized itineraries, chat with our AI travel assistant, and check the weather for your adventure. Start exploring the world with TravelGenie today!
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <Link to="/itinerary" className="btn btn-large" style={{ backgroundColor: "#1E90FF" }}>
          AI Itinerary Generator
        </Link>
        <Link to="/weather" className="btn btn-large" style={{ backgroundColor: "#FFB300", color: "#fff" }}>
          Weather Checker
        </Link>
        <Link to="/chat" className="btn btn-large" style={{ backgroundColor: "#1E90FF" }}>
          Travel Chatbot
        </Link>
      </div>
      <div style={{
        marginTop: "54px",
        color: "#888",
        fontSize: "0.98rem"
      }}>
        ✈️ Ready for your next adventure?
      </div>
    </div>
  );
}

export default HomePage;
