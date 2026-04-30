fetch("http://localhost:3000/api/pdf", {
  method: "OPTIONS",
  headers: { "Content-Type": "application/json" }
}).then(async res => {
  console.log("Status:", res.status);
  console.log("headers:", res.headers);
  console.log("Body length:", (await res.text()).length);
}).catch(err => console.error(err));
