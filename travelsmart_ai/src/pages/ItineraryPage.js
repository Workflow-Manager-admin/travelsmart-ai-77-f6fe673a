import React, { useState, useEffect } from "react";

// PUBLIC_INTERFACE
function ItineraryPage() {
  /**
   * User provides 'From', 'To', 'Start Date', and 'End Date'; Cohere API called for day-by-day itinerary;
   * Results are clearly separated by day; real-time flight results shown below (if available).
   */
  const [form, setForm] = useState({
    from: "",
    to: "",
    startDate: "",
    endDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [itineraryText, setItineraryText] = useState(""); // AI raw output
  const [itineraryByDay, setItineraryByDay] = useState([]); // Parsed for per-day display
  const [error, setError] = useState("");

  // Flight API state
  const [flightOptions, setFlightOptions] = useState([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [showFlights, setShowFlights] = useState(false);

  // COHERE KEY (should use .env in real deployment)
  const COHERE_KEY = 'xyV9r163fmM8ieMhIFAUbmymr6DakgKJ8wj520lv'
  // Amadeus flight API keys (fetch from .env if present, fallback for demo)
  const AMA_API_KEY = process.env.REACT_APP_AMADEUS_API_KEY || 'I3Qf2ShydSGU7hDgLDG3IAl3hHO5QJwt'
  const AMA_API_SECRET = process.env.REACT_APP_AMADEUS_API_SECRET || '0FMhmIHl7JHsbFpy'

  // PUBLIC_INTERFACE
  async function fetchItineraryCohere({ from, to, startDate, endDate }) {
    // Construct prompt for day-by-day output, using only trip start and end dates
    const prompt =
`Create a detailed travel itinerary for this trip:
From: ${from}
To: ${to}
Start date: ${startDate}
End date: ${endDate}

For each day, write a heading 'Day X:' and then list the main activities or recommendations (separated by newlines). Be concise and practical, and include tips or must-see places if relevant.

Example format:
Day 1:
- Arrive
- Activity
Day 2:
- Activity
...
Continue day by day, ensuring the number of days matches the duration between the start and end dates (inclusive).
Use the given trip start and end dates to determine length.`;

    const res = await fetch("https://api.cohere.ai/v1/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${COHERE_KEY}`,
        "Content-Type": "application/json",
        "Cohere-Version": "2022-12-06"
      },
      body: JSON.stringify({
        model: "command",
        prompt,
        max_tokens: 600,
        temperature: 0.8
      }),
    });
    if (!res.ok) throw new Error("Failed to generate itinerary. API error.");
    const data = await res.json();
    return data?.generations?.[0]?.text || "No result.";
  }

  // Parse itinerary string into [{day, activities:[]}, ...]
  function parseItineraryByDay(itineraryText) {
    if (!itineraryText) return [];
    const lines = itineraryText.split(/\r?\n/);
    const result = [];
    let currentDay = null;
    let currentActivities = [];
    let dayRegex = /^Day (\d+)[:：]?/i;
    lines.forEach((line) => {
      const match = line.match(dayRegex);
      if (match) {
        // New day heading
        if (currentDay || currentActivities.length > 0) {
          result.push({
            day: currentDay,
            activities: currentActivities,
          });
        }
        currentDay = `Day ${match[1]}`;
        currentActivities = [];
      } else if (line.trim().length) {
        // Remove leading dash/bullet/number and trim
        const activity = line.replace(/^[\-•\*\d\.\s]+/, "").trim();
        if (activity) {
          currentActivities.push(activity);
        }
      }
    });
    // Push the last day
    if (currentDay || currentActivities.length > 0) {
      result.push({
        day: currentDay,
        activities: currentActivities,
      });
    }
    // Remove empty days
    return result.filter(d => d.day && d.activities.length > 0);
  }

  // PUBLIC_INTERFACE
  async function fetchAmadeusAuth() {
    /** Authorize with Amadeus API to get a bearer token. */
    const res = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(AMA_API_KEY)}&client_secret=${encodeURIComponent(AMA_API_SECRET)}`
    });
    if (!res.ok) throw new Error("Failed to authenticate with Amadeus.");
    const data = await res.json();
    return data.access_token;
  }

  // Get correct IATA airport code using Amadeus Location API
  const getAirportCode = async (cityName, token) => {
    const res = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations?keyword=${encodeURIComponent(cityName)}&subType=CITY,AIRPORT`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.data?.[0]?.iataCode || cityName.slice(0, 3).toUpperCase();
  };

  // PUBLIC_INTERFACE
  async function fetchAmadeusFlights({ from, to, departureDate }) {
    let token = authToken;
    if (!token) {
      token = await fetchAmadeusAuth();
      setAuthToken(token);
    }
    const origin = await getAirportCode(from, token);
    const destination = await getAirportCode(to, token);
    // Use departureDate, fallback today
    const dateStr = (departureDate || new Date().toISOString().slice(0, 10));
    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${dateStr}&adults=1&currencyCode=USD&max=6`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.errors?.[0]?.detail ||
        "Could not retrieve flights. Check airport codes and API credentials."
      );
    }
    const data = await res.json();
    return data.data || [];
  };

  // Handles user explicit search for flights
  const handleFlightSearch = async () => {
    setFlightsError("");
    setFlightsLoading(true);
    setShowFlights(false);
    setFlightOptions([]);
    try {
      if (!form.from.trim() || !form.to.trim() || !form.startDate.trim()) {
        throw new Error("Enter From, To, and Start Date to search flights.");
      }
      let token = authToken;
      if (!token) {
        token = await fetchAmadeusAuth();
        setAuthToken(token);
      }
      // Fetch flights with selected date & locations
      const flights = await fetchAmadeusFlights({ from: form.from, to: form.to, departureDate: form.startDate });
      setFlightOptions(flights);
      setShowFlights(true);
      if (flights.length === 0) {
        setFlightsError("No flights found for those inputs. Try different cities or date.");
      }
    } catch (err) {
      setFlightsError(err.message || "Error fetching flights.");
      setFlightOptions([]);
      setShowFlights(true);
    } finally {
      setFlightsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({
      ...f,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setItineraryText("");
    setItineraryByDay([]);
    setLoading(true);
    try {
      if (!COHERE_KEY) throw new Error("AI API key is missing (REACT_APP_COHERE_KEY).");
      if (
        !form.from.trim() ||
        !form.to.trim() ||
        !form.startDate.trim() ||
        !form.endDate.trim()
      ) {
        throw new Error("All fields required.");
      }
      if (form.endDate < form.startDate) {
        throw new Error("End Date cannot be earlier than Start Date.");
      }
      const text = await fetchItineraryCohere(form);
      setItineraryText(text.trim());
      setItineraryByDay(parseItineraryByDay(text));
    } catch (err) {
      setError(err.message || "Failed to generate itinerary.");
    } finally {
      setLoading(false);
    }
  };

  // Side effect: fetch flights when from/to are filled in (don't require date anymore)
  useEffect(() => {
    async function loadFlights() {
      if (form.from.trim().length >= 3 && form.to.trim().length >= 3 && AMA_API_KEY && AMA_API_SECRET) {
        setFlightsError("");
        setFlightsLoading(true);
        try {
          let token = authToken;
          if (!token) {
            token = await fetchAmadeusAuth();
            setAuthToken(token);
          }
          // Use new token for this run
          const flights = await fetchAmadeusFlights({ from: form.from, to: form.to });
          setFlightOptions(flights);
        } catch (err) {
          setFlightsError(
            err.message ||
              "No flights found or error fetching. Note: free Amadeus test API may not return all city pairs."
          );
          setFlightOptions([]);
        } finally {
          setFlightsLoading(false);
        }
      } else {
        setFlightOptions([]);
      }
    }

    loadFlights();
    // eslint-disable-next-line
  }, [form.from, form.to, AMA_API_KEY, AMA_API_SECRET]); // Only runs on relevant param changes

  function formatFlight(f) {
    const out = f.itineraries?.[0]?.segments?.[0];
    const inArr = f.itineraries?.[0]?.segments?.[f.itineraries[0].segments.length - 1];
    return {
      airline: out?.carrierCode || "N/A",
      departure: out?.departure?.at || "N/A",
      arrival: inArr?.arrival?.at || "N/A",
      from: out?.departure?.iataCode || "",
      to: inArr?.arrival?.iataCode || "",
      duration: f.itineraries?.[0]?.duration || "",
      price: f.price?.total || "",
      currency: f.price?.currency || "USD"
    };
  }

  return (
    <div className="container" style={{ maxWidth: 540, marginTop: 110 }}>
      <h2 className="title" style={{ fontSize: "2.2rem", marginBottom: 16 }}>
        AI Itinerary Generator
      </h2>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          border: "1px solid var(--border-color)",
          borderRadius: 8,
          padding: 24,
          background: "rgba(255,255,255,0.04)"
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1 }}>
            From:<br />
            <input
              name="from"
              value={form.from}
              onChange={handleChange}
              required
              className="input"
              autoFocus
              placeholder="e.g., New York"
            />
          </label>
          <label style={{ flex: 1 }}>
            To:<br />
            <input
              name="to"
              value={form.to}
              onChange={handleChange}
              required
              className="input"
              placeholder="e.g., Paris"
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <label style={{ flex: 1 }}>
            Start Date:<br />
            <input
              name="startDate"
              type="date"
              value={form.startDate}
              onChange={handleChange}
              required
              className="input"
              style={{ maxWidth: 200 }}
              min={new Date().toISOString().split('T')[0]}
            />
          </label>
          <label style={{ flex: 1 }}>
            End Date:<br />
            <input
              name="endDate"
              type="date"
              value={form.endDate}
              onChange={handleChange}
              required
              className="input"
              style={{ maxWidth: 200 }}
              min={form.startDate || new Date().toISOString().split('T')[0]}
            />
          </label>
        </div>
        {/* Number of Days field removed */}
        <button className="btn btn-large" type="submit" disabled={loading}>
          {loading ? "Generating..." : "Generate Itinerary"}
        </button>
      </form>
      <button
        className="btn btn-large btn-secondary"
        style={{marginTop: 18, marginBottom: 8, width: "100%"}}
        onClick={handleFlightSearch}
        disabled={
          flightsLoading ||
          !form.from.trim() ||
          !form.to.trim() ||
          !form.startDate.trim()
        }
        type="button"
      >
        {flightsLoading ? "Searching flights..." : "Search Flights"}
      </button>
      {(flightsError && showFlights) && <div style={{ color: "tomato", margin: "10px 0", fontWeight: 600 }}>{flightsError}</div>}

      {showFlights && !flightsLoading && flightOptions && flightOptions.length > 0 && (
        <div
          style={{
            marginTop: 18,
            marginBottom: 24,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "16px 13px",
            border: "1.5px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            gap: "13px"
          }}
        >
          <div
            className="subtitle"
            style={{
              color: "var(--secondary)",
              fontWeight: 600,
              marginBottom: 6,
              fontSize: "1.13rem",
              letterSpacing: "0.01em",
            }}
          >
            Flights on {form.startDate}:
          </div>
          <div style={{display: "flex", flexWrap: "wrap", gap: 14}}>
          {flightOptions.map((f, i) => {
            const info = formatFlight(f);
            return (
              <div
                key={i}
                style={{
                  border: "1.5px solid var(--border-color)",
                  background: "white",
                  borderRadius: 10,
                  minWidth: 260,
                  maxWidth: "49%",
                  boxSizing: "border-box",
                  padding: "13px 15px",
                  boxShadow: "0 1px 8px 0 rgba(59,130,246,0.08)",
                  flex: "1 1 260px"
                }}
              >
                <div style={{fontWeight: 600, marginBottom: 7, color: "var(--secondary)"}}>
                  {info.from} <span style={{fontWeight:400}}>&rarr;</span> {info.to}
                </div>
                <div style={{fontWeight: 500}}>
                  Airline:{" "}
                  <span style={{color: "#3B82F6"}}>{info.airline}</span>
                </div>
                <div style={{margin: "3px 0", fontSize: ".97rem"}}>
                  <b>Departure:</b> {info.departure.replace("T", " ").slice(0, 16)}
                  <br />
                  <b>Arrival:</b> {info.arrival.replace("T", " ").slice(0, 16)}
                </div>
                <div style={{fontSize: ".97rem"}}><b>Duration:</b> {info.duration.replace("PT", "")}</div>
                <div style={{marginTop: 5, fontWeight: 600, color: "#F59E0B"}}>
                  {info.currency} {info.price}
                </div>
              </div>
            );
          })}
          </div>
          <div style={{ marginTop: 7, color: "var(--text-secondary)", fontSize: ".97rem" }}>
            Flights powered by Amadeus API. Prices/sample data for 1 adult.
          </div>
        </div>
      )}

      {error && <div style={{ color: "tomato", marginTop: 12 }}>{error}</div>}
      {itineraryByDay.length > 0 && (
        <div
          style={{
            marginTop: 36,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 8,
            padding: 22,
          }}
        >
          <div className="subtitle" style={{ marginBottom: 10 }}>
            AI-Generated Itinerary:
          </div>
          <div style={{ 
            marginBottom: 16,
            color: "var(--text-secondary)",
            fontSize: ".98rem"
          }}>
            <b>From:</b> {form.from} <b>To:</b> {form.to} <br/>
            <b>Start Date:</b> {form.startDate} <b>End Date:</b> {form.endDate}
          </div>
          {itineraryByDay.map(({ day, activities }) => (
            <div
              key={day}
              style={{
                marginBottom: 22,
                borderLeft: "4px solid var(--accent)",
                paddingLeft: 11,
                background: "rgba(234, 97, 97,0.05)",
                borderRadius: 6,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "1.04rem", marginBottom: 4 }}>
                {day}
              </div>
              <ul style={{ margin: "0 0 0 10px", padding: 0, color: "var(--text-secondary)" }}>
                {activities.map((act, idx) => (
                  <li key={idx} style={{marginBottom: 2}}>{act}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "4px 8px",
  textAlign: "left",
  fontWeight: 500
};
const tdStyle = {
  padding: "4px 8px"
};

export default ItineraryPage;
