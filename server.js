require("dotenv").config();
const express = require("express");
const cors = require("cors");
const ordersRoutes = require("./routes/orders");
const paymentsRoutes = require("./routes/payments");
const settingsRoutes = require("./routes/settings");

const app = express();
app.use(cors());

app.use("/api/orders", ordersRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/", (req, res) => res.send("API imprenta funcionando"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend corriendo en puerto ${PORT}`));
