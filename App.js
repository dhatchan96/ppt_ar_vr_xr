import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { FaBars, FaShieldAlt } from "react-icons/fa";
import CommandCenter from './components/CommandCenter';
import ActiveThreatsManagement from './components/ActiveThreatsManagement';
import VSCodeScans from './components/VSCodeScans';
import ThreatShields from './components/ThreatShields';
import ThreatIntelligence from './components/ThreatIntelligence';
import AdminPanel from './components/AdminPanel';
import AdminDataManagement from './components/AdminDataManagement';
import HealthCheck from './components/HealthCheck';
import ScanHistory from './components/ScanHistory';
import JobMonitorPage from './components/JobMonitorPage';
import MetricsSummary from './components/MetricsSummary';
import Rules from './components/Rules';
import SecurityTechDebt from './components/SecurityTechDebt';
import CopilotRemediation from './components/CopilotRemediation';
import EnhancedVulnerabilityManagement from './components/EnhancedVulnerabilityManagement';
import WaveManagement from './components/WaveManagement';
import Sidebar from './components/Sidebar';

function MainLayout({ sidebarCollapsed, toggleSidebar, jobResults, setJobResults }) {
  // Now useLocation is inside Router context
  const { pathname } = require('react-router-dom').useLocation();
  const navigate = useNavigate();

  const pageTitles = {
    '/dashboard': 'Command Center',
    '/threats': 'Action Hub',
    '/vscode-scans': 'VSCode Extension Scans',
    '/rules': 'Security Rules',
    '/threat-shields': 'Threat Shields',
    '/threat-intelligence': 'Threat Intelligence',
    '/security-tech-debt': 'Tech Debt',
    '/copilot-remediation': 'Copilot Remediation',
    '/enhanced-vulnerabilities': 'Enhanced Vulnerability Management',
    '/wave-management': 'Wave Management',
    '/admin': 'Admin Panel',
    '/admin-data': 'Admin Data Management',
    '/scan-history': 'Scan History',
    '/job-monitor': 'Job Monitor',
    '/health': 'System Health',
    '/summary': 'Metrics Summary',
    '/metrics': 'Metrics',
    '/': 'Command Center'
  };

  const currentTitle = pageTitles[pathname] || 'Dashboard';

  const handleJobComplete = (data) => {
    console.log('🔍 Job completed with data:', data);
    setJobResults(data);
    // Navigate back to dashboard using React Router
    navigate('/dashboard');
  };

  return (
    <div className="" style={{ background: "#f5f7fb", minHeight: "100vh" }}>
      <div
        className={`p-2 vh-100 fixed-top ${
          sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"
        }`}
        style={{
          transition: "width 0.3s",
          width: sidebarCollapsed ? "70px" : "280px",
          background: "#ffffff",
          borderRight: "1px solid #e1e5e9",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
        }}
      >
        <div className="d-flex flex-column justify-content-between align-items-center mb-3">
          <span
            className="navbar-brand fw-bold d-flex align-items-center"
            style={{ fontSize: "1.5rem" }}
          >
            <FaShieldAlt className="" style={{ fontSize: "2rem", color: "#111827" }} />
            <div className="d-flex flex-column">
              {!sidebarCollapsed && (
                <div className="d-inline-block ms-2" style={{ color: "#111827" }}>ThreatGuard Pro</div>
              )}
              {!sidebarCollapsed && (
                <span
                  className="ms-2"
                  style={{ fontSize: "0.7rem", letterSpacing: "0.17rem", color: "#374151" }}
                >
                 
                </span>
              )}
            </div>
          </span>
        </div>
        <Sidebar sidebarCollapsed={sidebarCollapsed} />
      </div>

      <div
        className=""
        style={{
          marginLeft: sidebarCollapsed ? "70px" : "280px",
          transition: "margin-left 0.3s",
          boxShadow: "0 0 2rem 0 rgba(33, 37, 41, .1)",
        }}
      >
        <nav
          className="navbar navbar-expand-lg navbar-light bg-white border-bottom shadow-sm px-4 fixed-top"
          style={{
            marginLeft: sidebarCollapsed ? "70px" : "280px",
            transition: "margin-left 0.3s",
          }}
        >
          <FaBars onClick={toggleSidebar} className="cursor-pointer" />
          <div className="navbar-brand ms-3">{currentTitle}</div>
          <img
            src="https://via.placeholder.com/250x40?text=ThreatGuard+Logo"  
            className="img-fluid rounded-top ms-auto align-self-center"
            alt="ThreatGuard Logo"
            style={{ width: "250px", height: "40px", }}
          />
        </nav>

        <div className="container-fluid p-4" style={{ marginTop: "60px" }}>
          <Routes>
            <Route path="/dashboard" element={<CommandCenter jobResults={jobResults} setJobResults={setJobResults} />} />
            <Route path="/threats" element={<ActiveThreatsManagement />} />
            <Route path="/vscode-scans" element={<VSCodeScans />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/threat-shields" element={<ThreatShields />} />
            <Route path="/threat-intelligence" element={<ThreatIntelligence />} />
            <Route path="/security-tech-debt" element={<SecurityTechDebt />} />
            <Route path="/copilot-remediation" element={<CopilotRemediation />} />
            <Route path="/enhanced-vulnerabilities" element={<EnhancedVulnerabilityManagement />} />
            <Route path="/wave-management" element={<WaveManagement />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin-data" element={<AdminDataManagement />} />
            <Route path="/scan-history" element={<ScanHistory />} />
            <Route path="/job-monitor" element={
              <JobMonitorPage 
                onJobComplete={handleJobComplete}
                onBack={() => navigate('/dashboard')}
              />
            } />
            <Route path="/health" element={<HealthCheck />} />
            <Route path="/summary" element={<MetricsSummary jobResults={jobResults} setJobResults={setJobResults} />} />
            <Route path="/" element={<CommandCenter jobResults={jobResults} setJobResults={setJobResults} />} />
            <Route path="/metrics" element={<MetricsSummary jobResults={jobResults} setJobResults={setJobResults} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [jobResults, setJobResults] = useState(null);
  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  return (
    <Router>
      <MainLayout 
        sidebarCollapsed={sidebarCollapsed} 
        toggleSidebar={toggleSidebar}
        jobResults={jobResults}
        setJobResults={setJobResults}
      />
    </Router>
  );
}