const express = require("express");
const router = express.Router();
const db = require("../db");

// Global Search API
router.get("/", async (req, res) => {
  const query = req.query.q;
  if (!query || query.trim() === "") {
    return res.json({ results: [] });
  }

  try {
    const searchTerm = `%${query}%`;

    // Search across multiple tables with correct column names
    const teamMembers = await db.query(
      "SELECT id, name AS label, 'Team Member' AS type, email FROM team_members WHERE (name LIKE ? OR email LIKE ?) AND is_active = true LIMIT 5", 
      [searchTerm, searchTerm]
    );

    const projects = await db.query(
      "SELECT id, name AS label, 'Project' AS type, description FROM projects WHERE (name LIKE ? OR description LIKE ?) LIMIT 5", 
      [searchTerm, searchTerm]
    );

    const tasks = await db.query(
      "SELECT id, name AS label, 'Task' AS type, description FROM tasks WHERE (name LIKE ? OR description LIKE ?) LIMIT 5", 
      [searchTerm, searchTerm]
    );

    const teams = await db.query(
      "SELECT id, name AS label, 'Team' AS type, description FROM teams WHERE (name LIKE ? OR description LIKE ?) AND is_active = true LIMIT 5", 
      [searchTerm, searchTerm]
    );

    const categories = await db.query(
      "SELECT id, name AS label, 'Category' AS type, description FROM categories WHERE (name LIKE ? OR description LIKE ?) LIMIT 5", 
      [searchTerm, searchTerm]
    );

    const skills = await db.query(
      "SELECT id, name AS label, 'Skill' AS type, description FROM skills WHERE (name LIKE ? OR description LIKE ?) LIMIT 5", 
      [searchTerm, searchTerm]
    );

    // Combine results and add navigation paths
    const results = [
      ...teamMembers.map(item => ({ ...item, path: `/team/members/${item.id}` })),
      ...projects.map(item => ({ ...item, path: `/projects/${item.id}` })),
      ...tasks.map(item => ({ ...item, path: `/tasks/${item.id}` })),
      ...teams.map(item => ({ ...item, path: `/team/teams/${item.id}` })),
      ...categories.map(item => ({ ...item, path: `/categories/${item.id}` })),
      ...skills.map(item => ({ ...item, path: `/skills/${item.id}` }))
    ];

    res.json({ 
      success: true,
      results,
      total: results.length 
    });
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Search failed", 
      error: error.message 
    });
  }
});

module.exports = router;
