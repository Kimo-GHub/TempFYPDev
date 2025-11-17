import React, { useEffect, useState } from 'react';

export default function ForecastChatbot() {
  const [message, setMessage] = useState("Analyzing forecast...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/forecast/recommendations/")
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage("Error loading recommendations"));
  }, []);

  return (
    <div style={{
      width: "380px",
      border: "1px solid #ddd",
      padding: "16px",
      borderRadius: "8px",
      background: "#fafafa",
      marginTop: "20px"
    }}>
      <h3>💬 Forecast Assistant</h3>
      <p style={{whiteSpace: "pre-line"}}>{message}</p>
    </div>
  );
}
