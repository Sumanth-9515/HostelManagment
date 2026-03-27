import React from "react";
import { Link, useLocation } from "react-router-dom";

const Sidebar = () => {
  const location = useLocation();

  const navLinks = [
    { name: "Add Hostel", path: "/addhostel", icon: "🏗️" },
    { name: "Add Candidate", path: "/addcandidate", icon: "👥" },
    { name: "Overview", path: "/overview", icon: "📊" }
  ];

  return (
    <aside className="fixed top-16 left-0 z-40 w-64 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700 shadow-sm transition-transform hidden md:block">
      <div className="flex flex-col h-full py-4 overflow-y-auto">
        <ul className="space-y-2 px-3">
          {navLinks.map((link) => (
            <li key={link.name}>
              <Link
                to={link.path}
                className={`flex items-center p-3 rounded-lg transition-colors ${
                  location.pathname === link.path
                    ? "bg-blue-100 text-blue-700 dark:bg-gray-700 dark:text-blue-400"
                    : "text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                }`}
              >
                <span className="text-xl mr-3">{link.icon}</span>
                <span className="font-medium">{link.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;