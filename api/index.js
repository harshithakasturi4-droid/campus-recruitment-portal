
// Vercel Serverless Function entrypoint
// Dynamically import the ES module Express app.

module.exports = async (req, res) => {
  try {
    const { default: app } = await import(
      "../artifacts/api-server/dist/app.mjs"
    );

    return app(req, res);
  } catch (error) {
    console.error("Failed to load API application:", error);

    return res.status(500).json({
      error: "Failed to initialize the API server.",
    });
  }
};

