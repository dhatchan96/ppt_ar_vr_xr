import React, { useState } from "react";
import { NavLink } from 'react-router-dom';
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaShieldAlt,
  FaExclamationTriangle,
  FaEye,
  FaBrain,
  FaHeartbeat,
  FaChartBar,
  FaCogs,
  FaTools,
  FaRobot,
  FaCode,
  FaBug,
  FaLayerGroup,
  FaSpinner,
  FaChevronDown
} from "react-icons/fa";
import PropTypes from "prop-types";

const sidebarItems = [
  {
    type: "dropdown",
    label: "Action",
    icon: <FaCogs className="me-1" />,
    items: [
      {
        to: "/",
        icon: <FaEye className="me-1" />,
        label: "Command Center"
      },
      {
        to: "/threats",
        icon: <FaExclamationTriangle className="me-1" />,
        label: "Action Hub"
      }
    ]
  },
  {
    type: "dropdown",
    label: "Remediate",
    icon: <FaTools className="me-1" />,
    items: [
      {
        to: "/copilot-remediation",
        icon: <FaRobot className="me-1" />,
        label: "AI Remediation"
      }
    ]
  },
  {
    type: "dropdown",
    label: "Configure",
    icon: <FaCogs className="me-1" />,
    items: [
      {
        to: "/rules",
        icon: <FaCogs className="me-1" />,
        label: "Security Rules"
      },
      {
        to: "/threat-shields",
        icon: <FaShieldAlt className="me-1" />,
        label: "Threat Shields"
      },
      {
        to: "/threat-intelligence",
        icon: <FaBrain className="me-1" />,
        label: "Threat Intelligence"
      },
      {
        to: "/admin-data",
        icon: <FaCogs className="me-1" />,
        label: "Admin Data"
      }
    ]
  },
  {
    type: "dropdown",
    label: "Reports",
    icon: <FaChartBar className="me-1" />,
    items: [
      {
        to: "/job-monitor",
        icon: <FaSpinner className="me-1" />,
        label: "Job Monitor"
      },
      {
        to: "/metrics",
        icon: <FaChartBar className="me-1" />,
        label: "Metrics"
      }
    ]
  },
  {
    type: "item",
    to: "/health",
    icon: <FaHeartbeat className="me-1" />,
    label: "System Health"
  }
];

function getSidebarLabel(label, sidebarCollapsed) {
  // Always return the label for now to debug the issue
  return label;
}

export default function Sidebar({ sidebarCollapsed }) {
  // Initialize with all dropdowns expanded for debugging
  const [expandedDropdowns, setExpandedDropdowns] = useState(new Set(["Action", "Remediate", "Configure", "Reports"]));

  const toggleDropdown = (dropdownLabel) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dropdownLabel)) {
        newSet.delete(dropdownLabel);
      } else {
        newSet.add(dropdownLabel);
      }
      return newSet;
    });
  };

  const isDropdownExpanded = (dropdownLabel) => {
    return expandedDropdowns.has(dropdownLabel);
  };

  return (
    <ul className={`nav flex-column ${sidebarCollapsed ? "mt-4" : "mt-3"}`} style={{ background: "#ffffff", minHeight: "100vh", padding: "0", borderRight: "1px solid #e1e5e9", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)" }}>
      {sidebarItems.map((item, idx) => {
        if (item.type === "dropdown") {
          const isExpanded = isDropdownExpanded(item.label);
          return (
            <React.Fragment key={`dropdown-${idx}`}>
              <li className="nav-item">
                <button
                  className="nav-link w-100 text-start border-0 bg-transparent"
                  onClick={() => toggleDropdown(item.label)}
                  style={{
                    color: "#111827",
                    borderRadius: "5px",
                    fontWeight: "500",
                    padding: "0.75rem 1rem",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "space-between"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#f3f4f6";
                    e.target.style.color = "#111827";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "transparent";
                    e.target.style.color = "#111827";
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", minWidth: "0" }}>
                    {item.icon} {getSidebarLabel(item.label, sidebarCollapsed)}
                  </span>
                  {!sidebarCollapsed && (
                    <FaChevronDown 
                      size={12} 
                      style={{ 
                        transition: "transform 0.3s ease",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        color: "#374151"
                      }}
                    />
                  )}
                </button>
              </li>
              
              {/* Dropdown Items */}
              <div
                style={{
                  maxHeight: isExpanded ? "200px" : "0",
                  overflow: "hidden",
                  transition: "max-height 0.3s ease-in-out",
                  opacity: isExpanded ? 1 : 0,
                  transform: `translateY(${isExpanded ? 0 : -10}px)`,
                  transition: "all 0.3s ease",
                  paddingLeft: "1rem",
                  marginBottom: "0.5rem"
                }}
              >
                {item.items.map((subItem, subIdx) => (
                  <li className="nav-item" key={`${idx}-${subIdx}`} style={{ marginLeft: "0.5rem" }}>
                    <NavLink
                      to={subItem.to}
                      className={({ isActive }) => `nav-link mb-1 ${isActive ? "active" : ""}`}
                      style={({ isActive }) => ({
                        color: isActive ? "#111827" : "#374151",
                        background: isActive ? "#f3f4f6" : "transparent",
                        borderRadius: "5px",
                        fontWeight: isActive ? "bold" : "normal",
                        paddingLeft: sidebarCollapsed ? "1rem" : "1.5rem",
                        fontSize: "0.9rem",
                        transition: "all 0.2s ease",
                        borderLeft: sidebarCollapsed ? "none" : "2px solid transparent",
                        borderLeftColor: isActive ? "#374151" : "transparent",
                        display: "block",
                        textDecoration: "none"
                      })}
                      onMouseEnter={(e) => {
                        if (!e.target.classList.contains('active')) {
                          e.target.style.background = "#f3f4f6";
                          e.target.style.color = "#111827";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!e.target.classList.contains('active')) {
                          e.target.style.background = "transparent";
                          e.target.style.color = "#374151";
                        }
                      }}
                    >
                      {subItem.icon} {getSidebarLabel(subItem.label, sidebarCollapsed)}
                    </NavLink>
                  </li>
                ))}
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <li className="nav-item" key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => `nav-link mb-2 ${isActive ? "active" : ""}`}
                style={({ isActive }) => ({
                  color: isActive ? "#111827" : "#374151",
                  background: isActive ? "#f3f4f6" : "transparent",
                  borderRadius: "5px",
                  fontWeight: isActive ? "bold" : "normal",
                  transition: "all 0.2s ease"
                })}
                onMouseEnter={(e) => {
                  if (!e.target.classList.contains('active')) {
                    e.target.style.background = "#f3f4f6";
                    e.target.style.color = "#111827";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.target.classList.contains('active')) {
                    e.target.style.background = "transparent";
                    e.target.style.color = "#374151";
                  }
                }}
              >
                {item.icon} {getSidebarLabel(item.label, sidebarCollapsed)}
              </NavLink>
            </li>
          );
        }
      })}
    </ul>
  );
}
Sidebar.propTypes = {
  sidebarCollapsed: PropTypes.bool.isRequired,
};


 