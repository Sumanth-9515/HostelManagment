import dotenv from "dotenv";
dotenv.config();

console.log("API Key Loaded:", process.env.BREVO_API_KEY ? "YES" : "NO");

const response = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "accept": "application/json",
    "api-key": process.env.BREVO_API_KEY,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    sender: {
      name: "Nilayam HMS",
      email: "nilayamhostelmanagment@gmail.com",
    },
    to: [
      {
        email: "myakalasumanthreddy@gmail.com",
        name: "Sumanth",
      },
    ],
    subject: "Test Mail from Nilayam HMS",
    htmlContent: "<h3>Brevo test mail working</h3><p>If you received this, Brevo API is working.</p>",
  }),
});

const data = await response.json();

console.log("Status:", response.status);
console.log("Response:", data);