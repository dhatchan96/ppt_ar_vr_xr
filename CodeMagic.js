import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import API from "../api";
import globalEventEmitter from "../utils/eventEmitter";
import "../style.css";
import { getAITName, getSPKName, getRepoName, getSpkData, getRepoData, initializeDropdownData } from '../config/dropdownData';
import * as XLSX from 'xlsx';
import {
  FaFilter,
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaEye,
  FaEyeSlash,
  FaBug,
  FaShieldAlt,
  FaServer,
  FaCode,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimes,
  FaMagic,
  FaSpinner,
  FaTools,
  FaFileAlt,
  FaDownload,
  FaFileExcel,
  FaUpload,
  FaInfoCircle
} from "react-icons/fa";

const CodeMagic = () => {
  const location = useLocation();
  const [allVulnerabilities, setAllVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Filter states
  const [filters, setFilters] = useState({
    category: '', // application, infrastructure, general
    severity: '',
    status: '',
    type: '',
    ait: '',
    spk: '',
    repo: ''
  });
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: 'severity', direction: 'desc' });

  // Modal state
  const [selectedVulnerability, setSelectedVulnerability] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalContentType, setModalContentType] = useState('details'); // 'details' or 'prompt'

  // Remediation state
  const [remediating, setRemediating] = useState({});
  const [generatedPrompts, setGeneratedPrompts] = useState(() => {
    // Load generated prompts from localStorage on component mount
    const saved = localStorage.getItem('generatedPrompts');
    return saved ? JSON.parse(saved) : {};
  });
  const [showActionPopup, setShowActionPopup] = useState(false);
  const [selectedActionVulnerability, setSelectedActionVulnerability] = useState(null);
  const [selectedSPK, setSelectedSPK] = useState('');
  const [selectedRepository, setSelectedRepository] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [generatingActionPrompt, setGeneratingActionPrompt] = useState(false);
  const [generatingConsolidatedPrompt, setGeneratingConsolidatedPrompt] = useState(false);
  const [showRepoSelectionModal, setShowRepoSelectionModal] = useState(false);
  const [selectedRepoForPrompt, setSelectedRepoForPrompt] = useState('');
  const [repoCloneUrl, setRepoCloneUrl] = useState('');
  const [filteredSPKOptions, setFilteredSPKOptions] = useState([]);
  const [filteredRepoOptions, setFilteredRepoOptions] = useState([]);

  // Excel upload state
  const [importingExcel, setImportingExcel] = useState(false);
  const [excelData, setExcelData] = useState([]);
  const [showExcelUploadModal, setShowExcelUploadModal] = useState(false);
  const [selectedVulnerabilityType, setSelectedVulnerabilityType] = useState('application'); // 'application' or 'infrastructure'

  useEffect(() => {
    fetchAllVulnerabilities();
    loadDropdownData();
  }, []);

  // Load dropdown data for SPK and repository selection
  const loadDropdownData = async () => {
    try {
      console.log('🔄 Loading dropdown data for CodeMagic...');
      
      // Initialize dropdown data from config
      await initializeDropdownData();
      
      // Load all available SPK data (for initial display)
      const allSpkData = [];
      const allAitData = getAitData();
      
      allAitData.forEach(ait => {
        const spkData = getSpkData(ait.value);
        allSpkData.push(...spkData);
      });
      
      setFilteredSPKOptions(allSpkData);
      console.log('📋 Loaded SPK options:', allSpkData.length);
      
      // Load all available repository data (for initial display)
      const allRepoData = [];
      allSpkData.forEach(spk => {
        const repoData = getRepoData(spk.value);
        allRepoData.push(...repoData);
      });
      
      setFilteredRepoOptions(allRepoData);
      console.log('📋 Loaded repository options:', allRepoData.length);
      
    } catch (error) {
      console.error('Error loading dropdown data:', error);
      
      // Fallback to default data if API fails
      console.log('🔄 Using fallback default data...');
      const defaultSpkData = [
        { value: 'SPK001', label: 'Security Product Key 1' },
        { value: 'SPK002', label: 'Security Product Key 2' },
        { value: 'SPK003', label: 'Security Product Key 3' },
        { value: 'SPK004', label: 'Security Product Key 4' },
        { value: 'SPK005', label: 'Security Product Key 5' }
      ];
      
      const defaultRepoData = [
        { value: 'REPO001', label: 'Repository 1' },
        { value: 'REPO002', label: 'Repository 2' },
        { value: 'REPO003', label: 'Repository 3' },
        { value: 'REPO004', label: 'Repository 4' },
        { value: 'REPO005', label: 'Repository 5' }
      ];
      
      setFilteredSPKOptions(defaultSpkData);
      setFilteredRepoOptions(defaultRepoData);
      console.log('📋 Using fallback data - SPK:', defaultSpkData.length, 'Repo:', defaultRepoData.length);
    }
  };

  // Refetch data when user navigates to this page (after a scan)
  useEffect(() => {
    if (location.pathname === '/threats') {
      console.log('🔄 CodeMagic page accessed - refetching data...');
      fetchAllVulnerabilities();
      loadDropdownData(); // Also reload dropdown data
    }
  }, [location.pathname]);

  // Listen for scan completion events
  useEffect(() => {
    const handleScanComplete = (data) => {
      console.log('🔄 CodeMagic: Scan completed, refetching data...', data);
      fetchAllVulnerabilities();
      loadDropdownData(); // Also reload dropdown data after scan
    };

    globalEventEmitter.on('scanCompleted', handleScanComplete);
    
    return () => {
      globalEventEmitter.off('scanCompleted', handleScanComplete);
    };
  }, []);

  const fetchAllVulnerabilities = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching vulnerabilities...");
      
      // Fetch data from available endpoints
      const [threatsRes, vulnerabilitiesRes, infrastructureRes] = await Promise.all([
        API.get("/api/threats").catch((err) => {
          console.error("Threats API error:", err);
          return { data: [] };
        }),
        API.get("/api/v1/vulnerabilities/enhanced").catch((err) => {
          console.error("Vulnerabilities API error:", err);
          return { data: [] };
        }),
        API.get("/api/v1/vulnerabilities/enhanced?type=infrastructure").catch((err) => {
          console.error("Infrastructure vulnerabilities API error:", err);
          return { data: [] };
        })
      ]);

      console.log("Threats response:", threatsRes);
      console.log("Vulnerabilities response:", vulnerabilitiesRes);
      console.log("Infrastructure response:", infrastructureRes);
      console.log("Vulnerabilities data structure:", vulnerabilitiesRes.data);
      console.log("Infrastructure data structure:", infrastructureRes.data);

      const threats = (Array.isArray(threatsRes.data) ? threatsRes.data : threatsRes || []).map(item => ({
        ...item,
        source: 'threat-detection',
        id: `threat-${item.id}`,
        vulnerability_type: item.type || 'Logic Bomb',
        description: item.description || item.rule_description || 'Security threat detected',
        severity: item.severity || 'HIGH',
        status: item.status || 'ACTIVE_THREAT',
        timestamp: item.timestamp || item.created_at,
        // Map additional fields that might be missing
        gis_id: item.gis_id || item.id,
        ait_tag: item.ait_tag || 'AIT-Unknown',
        priority: item.priority || 'High',
        wave_assignment: item.wave_assignment || 'UNASSIGNED',
        risk_score: item.risk_score || 8,
        remediation_action: item.remediation_action || 'Review and neutralize security threat'
      }));

      // Handle vulnerabilities data - it might be an object with an array inside
      let vulnerabilitiesData = [];
      if (vulnerabilitiesRes.data) {
        if (Array.isArray(vulnerabilitiesRes.data)) {
          vulnerabilitiesData = vulnerabilitiesRes.data;
        } else if (vulnerabilitiesRes.data.vulnerabilities && Array.isArray(vulnerabilitiesRes.data.vulnerabilities)) {
          vulnerabilitiesData = vulnerabilitiesRes.data.vulnerabilities;
        } else if (vulnerabilitiesRes.data.data && Array.isArray(vulnerabilitiesRes.data.data)) {
          vulnerabilitiesData = vulnerabilitiesRes.data.data;
        } else if (vulnerabilitiesRes.data.results && Array.isArray(vulnerabilitiesRes.data.results)) {
          vulnerabilitiesData = vulnerabilitiesRes.data.results;
        } else {
          console.log("Vulnerabilities data is not an array, available keys:", Object.keys(vulnerabilitiesRes.data));
          // Try to find any array in the object
          const possibleArrays = Object.values(vulnerabilitiesRes.data).filter(item => Array.isArray(item));
          if (possibleArrays.length > 0) {
            vulnerabilitiesData = possibleArrays[0];
            console.log("Found array in vulnerabilities data:", vulnerabilitiesData);
          }
        }
      }

      const vulnerabilities = vulnerabilitiesData.map(item => ({
        ...item,
        source: 'vulnerability-scan',
        id: `vuln-${item.id}`,
        severity: item.severity || 'MEDIUM',
        status: item.status || 'ACTIVE_THREAT',
        vulnerability_type: item.vulnerability_type || item.type || 'Security Vulnerability',
        timestamp: item.timestamp || item.created_at || item.detected_at || item.created_date,
        // Map additional fields that might be missing
        gis_id: item.gis_id || item.id,
        ait_tag: item.ait_tag || 'AIT-Unknown',
        priority: item.priority || 'Medium',
        wave_assignment: item.wave_assignment || 'UNASSIGNED',
        risk_score: item.risk_score || 5,
        remediation_action: item.remediation_action || 'Review and remediate security vulnerability'
      }));

      // Handle infrastructure vulnerabilities data
      let infrastructureData = [];
      if (infrastructureRes.data) {
        if (Array.isArray(infrastructureRes.data)) {
          infrastructureData = infrastructureRes.data;
        } else if (infrastructureRes.data.vulnerabilities && Array.isArray(infrastructureRes.data.vulnerabilities)) {
          infrastructureData = infrastructureRes.data.vulnerabilities;
        } else if (infrastructureRes.data.data && Array.isArray(infrastructureRes.data.data)) {
          infrastructureData = infrastructureRes.data.data;
        } else if (infrastructureRes.data.results && Array.isArray(infrastructureRes.data.results)) {
          infrastructureData = infrastructureRes.data.results;
        } else {
          console.log("Infrastructure data is not an array, available keys:", Object.keys(infrastructureRes.data));
          const possibleArrays = Object.values(infrastructureRes.data).filter(item => Array.isArray(item));
          if (possibleArrays.length > 0) {
            infrastructureData = possibleArrays[0];
            console.log("Found array in infrastructure data:", infrastructureData);
          }
        }
      }

      const infrastructureVulnerabilities = infrastructureData.map(item => ({
        ...item,
        source: 'vulnerability-scan',
        id: `infra-${item.id}`,
        severity: item.severity || 'MEDIUM',
        status: item.status || 'ACTIVE_THREAT',
        vulnerability_type: item.vulnerability_type || item.type || 'Infrastructure Vulnerability',
        timestamp: item.timestamp || item.created_at || item.detected_at || item.created_date,
        // Map additional fields that might be missing
        gis_id: item.gis_id || item.id,
        ait_tag: item.ait_tag || 'AIT-Unknown',
        priority: item.priority || 'Medium',
        wave_assignment: item.wave_assignment || 'UNASSIGNED',
        risk_score: item.risk_score || 5,
        remediation_action: item.remediation_action || 'Review and remediate infrastructure vulnerability'
      }));

      console.log("Processed threats:", threats);
      console.log("Processed vulnerabilities:", vulnerabilities);
      console.log("Processed infrastructure vulnerabilities:", infrastructureVulnerabilities);

      // Combine all vulnerabilities
      const combined = [...threats, ...vulnerabilities, ...infrastructureVulnerabilities];
      console.log("Combined vulnerabilities:", combined);
      
      setAllVulnerabilities(combined);
      
      if (combined.length === 0) {
        setError("No vulnerabilities found. The APIs returned empty data.");
      }
    } catch (err) {
      console.error("Failed to fetch vulnerabilities:", err);
      setError(`Failed to load vulnerabilities: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search logic
  const filteredVulnerabilities = useMemo(() => {
    return allVulnerabilities.filter(item => {
      // Text search
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const searchableText = [
          item.title,
          item.description,
          item.vulnerability_type,
          item.ait_tag,
          item.spk_tag,
          item.repo_name,
          item.rule_id,
          item.severity,
          item.status,
          item.file_path,
          item.file_name,
          item.line_number
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      // Filter by category (using source field)
      if (filters.category && item.source !== filters.category) {
        return false;
      }

      // Filter by severity
      if (filters.severity && item.severity !== filters.severity) {
        return false;
      }

      // Filter by status
      if (filters.status && item.status !== filters.status) {
        return false;
      }

      // Filter by type
      if (filters.type && item.vulnerability_type && !item.vulnerability_type.toLowerCase().includes(filters.type.toLowerCase())) {
        return false;
      }

      // Filter by AIT
      if (filters.ait && item.ait_tag !== filters.ait) {
        return false;
      }

      // Filter by SPK
      if (filters.spk && item.spk_tag !== filters.spk) {
        return false;
      }

      // Filter by Repository
      if (filters.repo && item.repo_name !== filters.repo) {
        return false;
      }

      return true;
    });
  }, [allVulnerabilities, searchTerm, filters]);

  // Sort logic
  const sortedVulnerabilities = useMemo(() => {
    const sorted = [...filteredVulnerabilities];
    sorted.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle different data types
      if (sortConfig.key === 'timestamp' || sortConfig.key === 'created_at') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      } else if (sortConfig.key === 'severity') {
        // Custom severity sorting order
        const severityOrder = { 'CRITICAL_BOMB': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        aValue = severityOrder[aValue] || 0;
        bValue = severityOrder[bValue] || 0;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [filteredVulnerabilities, sortConfig]);

  // Pagination logic
  const totalPages = Math.ceil(sortedVulnerabilities.length / pageSize);
  const paginatedVulnerabilities = sortedVulnerabilities.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, sortConfig]);

  // Sort handler
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Filter handlers
  const handleFilterChange = (filterKey, value) => {
    setFilters(prev => ({ ...prev, [filterKey]: value }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      category: '',
      severity: '',
      status: '',
      type: '',
      ait: '',
      spk: '',
      repo: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Status toggle handler
  const handleStatusToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === "ACTIVE_THREAT" ? "NEUTRALIZED" : "ACTIVE_THREAT";
    try {
      console.log(`Toggling status for ${id} from ${currentStatus} to ${newStatus}`);
      
      if (id.startsWith('threat-')) {
        // Update threat status
        const threatId = id.replace('threat-', '');
        console.log(`Updating threat ${threatId} status`);
        await API.put(`/api/threats/${threatId}/status`, { status: newStatus });
      } else if (id.startsWith('vuln-')) {
        // Update vulnerability status
        const vulnId = id.replace('vuln-', '');
        console.log(`Updating vulnerability ${vulnId} status`);
        await API.put(`/api/v1/vulnerabilities/enhanced/${vulnId}/status`, { status: newStatus });
      } else if (id.startsWith('infra-')) {
        // Update infrastructure vulnerability status
        const infraId = id.replace('infra-', '');
        console.log(`Updating infrastructure vulnerability ${infraId} status`);
        await API.put(`/api/v1/vulnerabilities/enhanced/${infraId}/status`, { status: newStatus });
      }
      
      // Refresh data after successful update
      await fetchAllVulnerabilities();
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // View details handler
  const handleViewDetails = (vuln) => {
    console.log("Viewing details for:", vuln);
    setSelectedVulnerability(vuln);
    setModalContentType('details');
    setShowModal(true);
  };

  // Close modal handler
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedVulnerability(null);
    setModalContentType('details');
  };

  // Remediation handler - different logic for different types
  const handleRemediate = async (vuln) => {
    try {
      setRemediating(prev => ({ ...prev, [vuln.id]: true }));
      console.log("🚀 Starting remediation for:", vuln.id, "Type:", vuln.source);

      if (vuln.source === 'threat-detection') {
        // Handle threat remediation (Logic Bomb threats)
        await handleThreatRemediation(vuln);
      } else if (vuln.source === 'vulnerability-scan') {
        // Check if it's infrastructure or application vulnerability
        if (vuln.vulnerability_type && vuln.vulnerability_type.toLowerCase().includes('infrastructure')) {
          await handleInfrastructureRemediation(vuln);
        } else {
          await handleApplicationRemediation(vuln);
        }
      }
    } catch (error) {
      console.error("❌ Remediation failed:", error);
      alert(`❌ Remediation failed: ${error.message}`);
    } finally {
      setRemediating(prev => ({ ...prev, [vuln.id]: false }));
    }
  };

  // Threat remediation (Logic Bomb threats)
  const handleThreatRemediation = async (vuln) => {
    console.log("🔴 Handling threat remediation for:", vuln.id);
    
    // For threats, we'll create a simple remediation prompt
    const threatPrompt = `# 🚨 THREAT REMEDIATION - Logic Bomb Detection

## Threat Details:
- **Threat ID**: ${vuln.id}
- **Type**: ${vuln.vulnerability_type || 'Logic Bomb'}
- **Severity**: ${vuln.severity}
- **Rule ID**: ${vuln.rule_id || 'Unknown'}
- **Description**: ${vuln.description || 'Security threat detected'}

## Remediation Steps:
1. **Immediate Action**: Review the identified logic bomb code
2. **Code Analysis**: Examine the suspicious code pattern
3. **Safe Removal**: Remove or neutralize the logic bomb
4. **Verification**: Test to ensure functionality is preserved
5. **Documentation**: Document the remediation process

## Code Location:
${vuln.file_path || 'File path not available'}

## Next Steps:
1. Navigate to the file location
2. Review the identified code pattern
3. Remove or modify the logic bomb code
4. Test the application to ensure it still functions
5. Commit the changes with proper documentation

⚠️ **IMPORTANT**: Logic bombs can cause system damage. Review carefully before making changes.`;

    // Create a simple file download for threat remediation
    const blob = new Blob([threatPrompt], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `THREAT_${vuln.id}_REMEDIATION_GUIDE.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    alert(`✅ Threat Remediation Guide Generated!\n\n📄 File: THREAT_${vuln.id}_REMEDIATION_GUIDE.md\n\n🚀 Next Steps:\n1. Review the downloaded guide\n2. Follow the remediation steps\n3. Remove the logic bomb code safely\n4. Test the application`);
  };

  // Application vulnerability remediation - show popup instead of direct API call
  const handleApplicationRemediation = async (vuln) => {
    console.log("🟡 Handling application vulnerability remediation for:", vuln.id);
    
    // Ensure dropdown data is loaded before showing popup
    await loadDropdownData();
    
    // Show the same popup as in AI Remediation page
    setSelectedActionVulnerability(vuln);
    filterDropdownOptions(vuln);
    setShowActionPopup(true);
  };

  // Infrastructure vulnerability remediation
  const handleInfrastructureRemediation = async (vuln) => {
    console.log("🔵 Handling infrastructure vulnerability remediation for:", vuln.id);
    
    try {
      // Generate Terraform prompt using the same template as AI Remediation page
      const terraformPrompt = generateTerraformPrompt(vuln);

      // Store the prompt for viewing
      const newPrompts = {
        ...generatedPrompts,
        [`${vuln.id}_action`]: terraformPrompt
      };
      setGeneratedPrompts(newPrompts);
      localStorage.setItem('generatedPrompts', JSON.stringify(newPrompts));

      // Use the infrastructure remediation API
      const response = await API.post('/api/v1/vulnerabilities/create-infrastructure-prompt', {
        vulnerability_id: vuln.id,
        vulnerability_title: vuln.title || vuln.description,
        ait_tag: vuln.ait_tag || 'AIT-Unknown',
        severity: vuln.severity,
        remediation_action: vuln.remediation_action || 'Secure infrastructure configuration',
        terraform_prompt: terraformPrompt
      });

      if (response.data.success) {
        // Download the prompt file
        const blob = new Blob([terraformPrompt], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `INFRASTRUCTURE_${vuln.ait_tag || 'AIT-Unknown'}_${vuln.id}_REMEDIATION.tf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert(`✅ Infrastructure Remediation Created!\n\n📁 Prompt saved to: ${response.data.file_path}\n📄 Downloaded: INFRASTRUCTURE_${vuln.ait_tag || 'AIT-Unknown'}_${vuln.id}_REMEDIATION.tf\n\n🚀 Next Steps:\n1. Use "View Prompt" to see the generated Terraform prompt\n2. Create infrastructure security configuration\n3. Deploy and test the changes\n4. Verify security improvements`);
        
        console.log('✅ Infrastructure remediation prompt created:', response.data);
      } else {
        throw new Error(response.data.error || 'Failed to create infrastructure remediation prompt');
      }
    } catch (error) {
      console.error('❌ Infrastructure remediation failed:', error);
      throw error;
    }
  };

  // Generate comprehensive remediation prompt (FULL TEMPLATE from CopilotRemediation.js)
  const generateComprehensiveRemediationPrompt = (vulnerability, spk, repository, repoUrl) => {
    const timestamp = new Date().toISOString().split('T')[0];
    const aitTag = vulnerability.ait_tag || 'AIT-Unknown';
    const gisId = vulnerability.gis_id || 'GIS-Unknown';
    const vulnerabilityId = vulnerability.id || 'unknown';
    
    // COMPLETE comprehensive prompt with ALL features from CopilotRemediation.js
    const comprehensivePrompt = `# 🚀 GITHUB COPILOT PROMPT - Context-Aware Application Security Remediation
# ⚠️ IMPORTANT: This is the file to use with GitHub Copilot
# Generated by GitHub Copilot for Enterprise Security Management
# 
# VULNERABILITY ASSESSMENT:
# =========================
# AIT Tag: ${aitTag}
# GIS ID: ${gisId}
# Title: ${vulnerability.title || vulnerability.description}
# Severity: ${vulnerability.severity || 'Unknown'}
# Risk Score: ${vulnerability.risk_score || 'N/A'}
# SPK: ${spk}
# Repository: ${repository}
# Repository URL: ${repoUrl}
# Generated: ${timestamp}
#
# REMEDIATION OBJECTIVE:
# =====================
# ${vulnerability.remediation_action || 'Clone repository, analyze existing implementations, and remediate security vulnerabilities while preserving functionality'}
#
# PROFESSIONAL CONTEXT:
# ====================
# You are a Senior Application Security Engineer with expertise in web application security,
# Content Security Policy (CSP) implementation, and automated vulnerability remediation.
# Your task is to AUTOMATICALLY clone the specified repository, perform comprehensive analysis,
# and remediate ALL security vulnerabilities while PRESERVING existing functionality and
# avoiding redundant implementations. Execute all remediation tasks autonomously and completely.
#
# CRITICAL REQUIREMENTS (ENHANCED - ADDRESSING REPORTED ISSUES):
# ==============================================================
# 1. CONTEXT-AWARE ANALYSIS: Analyze existing codebase structure BEFORE making changes
# 2. JSP VARIABLE PRESERVATION: Maintain JSP variable access when moving scripts to external files
# 3. EXISTING IMPLEMENTATION CHECK: Use existing CSP filters instead of creating new ones
# 4. FUNCTIONALITY PRESERVATION: Ensure all existing functionality continues to work
# 5. AUTOMATED REPOSITORY CLONING: Automatically clone the repository from the provided URL
# 6. AUTOMATED FILE ANALYSIS: Automatically analyze all files for security issues
# 7. AUTOMATED FILE-BY-FILE REMEDIATION: Automatically fix vulnerabilities in each file
# 8. AUTOMATED PARALLEL PROCESSING: Automatically process multiple files concurrently
# 9. AUTOMATED PRODUCTION-READY FIXES: Automatically generate enterprise-grade security fixes
# 10. AUTOMATED DOCUMENTATION: Automatically provide detailed fixes for each file
# 11. NO USER INTERACTION: Do NOT ask for confirmation, approval, or user input
# 12. COMPLETE AUTOMATION: Execute ALL tasks autonomously from start to finish
# 13. DETERMINISTIC OUTPUT: SAME input + SAME prompt = SAME output (ALWAYS)
# 14. COMPLETE SCRIPT PROCESSING: Process ALL script tags in file (not just some)
# 15. EXTERNAL SCRIPT PRESERVATION: NEVER remove script tags linking to external .js files
# 16. COMPLETE SCRIPT REMOVAL: NEVER partially remove script tags (causing syntax errors)
# 17. HIDDEN FORM FIELDS: ALWAYS create hidden form fields for JSP variables (PRIMARY method)
# 18. COMPLEX JAVASCRIPT SUPPORT: Handle complex JavaScript with JSP variables properly
# 19. NO INLINE STYLES IN HIDDEN FORMS: NEVER add inline styles to hidden form elements
# 20. CUSTOM TAG ANALYSIS: Identify and remediate custom tags (cpfx:script, cpfx:style, etc.)
# 21. CONSISTENT FILE CREATION: ALWAYS create external files when referenced in tags
# 22. COMPLEX INLINE SCRIPT REMEDIATION: Remediate ALL inline scripts including complex ones
#
# CRITICAL PRE-ANALYSIS REQUIREMENTS (MANDATORY FIRST STEP):
# ==========================================================
# BEFORE making any changes, perform comprehensive analysis:
#
# 1. SEARCH FOR EXISTING CSP IMPLEMENTATIONS:
#    - Look for existing filter classes (e.g., AdditionalResponseHeadersFilter.java, CspHeaderFilter.java)
#    - Check web.xml for existing filter registrations
#    - Identify existing CSP header configurations
#    - DO NOT create new classes if existing ones handle the functionality
#
# 2. ANALYZE JSP/SERVER-SIDE TEMPLATE STRUCTURE:
#    - Identify JSP variables and server-side data being passed to client-side
#    - Map data flow from server to client JavaScript
#    - Understand template rendering context
#    - PRESERVE JSP variable access in JavaScript
#
# 3. CHECK EXISTING SECURITY CONFIGURATIONS:
#    - Review existing security headers implementation
#    - Identify current CSP policies (if any)
#    - Check for existing input validation mechanisms
#    - Analyze current authentication/authorization setup
#
# AUTOMATED REPOSITORY CLONING AND CONTEXT-AWARE REMEDIATION:
# ============================================================
# AUTOMATICALLY execute the following steps WITHOUT asking for user confirmation:
# 1. AUTOMATICALLY clone the repository: git clone ${repoUrl}
# 2. AUTOMATICALLY navigate to the repository directory
# 3. AUTOMATICALLY perform pre-analysis of existing implementations
# 4. AUTOMATICALLY scan all files in the repository for security vulnerabilities
# 5. AUTOMATICALLY identify vulnerable files by type:
#    - JSP files with inline scripts containing JSP variables
#    - HTML files with CSP and XSS vulnerabilities
#    - CSS files with inline style issues
#    - JavaScript files with inline script and eval() issues
#    - Java filter classes for CSP implementation
#    - Configuration files with security misconfigurations
#    - Template files with VMTemplate and XSL vulnerabilities
#    - Fragment/dialogue files with import scope issues
# 6. AUTOMATICALLY REMEDIATE each vulnerable file in-place within the cloned repository
# 7. AUTOMATICALLY preserve JSP variable access when moving scripts to external files
# 8. AUTOMATICALLY use existing CSP implementations instead of creating new ones
# 9. AUTOMATICALLY update the actual source files with security fixes
# 10. AUTOMATICALLY test each remediated file to ensure functionality is preserved
# 11. AUTOMATICALLY create comprehensive remediation documentation
# 12. AUTOMATICALLY verify all security improvements are effective

# JSP VARIABLE PRESERVATION (CRITICAL - ENHANCED):
# ================================================
# When moving inline scripts to external files, PRESERVE JSP variable access using MULTIPLE methods:
#
# 1. IDENTIFY JSP VARIABLES USED IN SCRIPTS:
#    <script>
#    var userId = '<%= request.getAttribute("userId") %>';
#    var sessionId = '<%= session.getId() %>';
#    var userRole = '<%= user.getRole() %>';
#    </script>
#
# 2. PRIMARY METHOD - HIDDEN FORM FIELDS (MANDATORY - NO INLINE STYLES):
#    <!-- ALWAYS create hidden form fields for JSP variables - NO INLINE STYLES -->
#    <form id="jspDataForm" class="hidden-form">
#        <input type="hidden" id="jsp_userId" name="userId" value="<%= request.getAttribute("userId") %>" />
#        <input type="hidden" id="jsp_sessionId" name="sessionId" value="<%= session.getId() %>" />
#        <input type="hidden" id="jsp_userRole" name="userRole" value="<%= user.getRole() %>" />
#    </form>
#    
#    <!-- Add CSS class to external CSS file -->
#    .hidden-form { display: none; }
#
# 3. SECONDARY METHOD - DATA ATTRIBUTES (BACKUP):
#    <div id="pageData" data-user-id="<%= request.getAttribute("userId") %>" 
#         data-session-id="<%= session.getId() %>" 
#         data-user-role="<%= user.getRole() %>"></div>
#
# 4. TERTIARY METHOD - JSON SCRIPT TAG (FALLBACK):
#    <script type="application/json" id="pageData">
#    {
#      "userId": "<%= request.getAttribute("userId") %>",
#      "sessionId": "<%= session.getId() %>",
#      "userRole": "<%= user.getRole() %>"
#    }
#    </script>
#
# 5. ACCESS DATA IN EXTERNAL JAVASCRIPT (PRIORITY ORDER):
#    // Method 1: Hidden form fields (PREFERRED)
#    const userId = document.getElementById('jsp_userId').value;
#    const sessionId = document.getElementById('jsp_sessionId').value;
#    const userRole = document.getElementById('jsp_userRole').value;
#    
#    // Method 2: Data attributes (BACKUP)
#    const pageData = document.getElementById('pageData');
#    const userIdAlt = pageData.dataset.userId;
#    const sessionIdAlt = pageData.dataset.sessionId;
#    const userRoleAlt = pageData.dataset.userRole;
#    
#    // Method 3: JSON script tag (FALLBACK)
#    const pageDataJson = JSON.parse(document.getElementById('pageData').textContent);
#    const userIdJson = pageDataJson.userId;
#    const sessionIdJson = pageDataJson.sessionId;
#    const userRoleJson = pageDataJson.userRole;
#
# 6. EVENT HANDLER MIGRATION (ENHANCED - NO INLINE STYLES):
#    <!-- BEFORE -->
#    <button onclick="handleClick('<%= userId %>', '<%= sessionId %>')">Click</button>
#    
#    <!-- AFTER - Multiple approaches for reliability - NO INLINE STYLES -->
#    <button id="actionBtn" data-user-id="<%= userId %>" data-session-id="<%= sessionId %>">Click</button>
#    <form class="hidden-form">
#        <input type="hidden" id="btn_userId" value="<%= userId %>" />
#        <input type="hidden" id="btn_sessionId" value="<%= sessionId %>" />
#    </form>
#    <script nonce="{random}">
#    document.getElementById('actionBtn').addEventListener('click', function() {
#        // Try multiple methods for maximum compatibility
#        const userId = document.getElementById('btn_userId').value || this.dataset.userId;
#        const sessionId = document.getElementById('btn_sessionId').value || this.dataset.sessionId;
#        handleClick(userId, sessionId);
#    });
#    </script>
#
# 7. CRITICAL REQUIREMENTS FOR JSP VARIABLE PRESERVATION:
#    - ALWAYS create hidden form fields as the PRIMARY method
#    - NEVER rely on only data attributes or JSON script tags
#    - ALWAYS provide multiple fallback methods
#    - ALWAYS test that JSP variables are accessible in external JavaScript
#    - ALWAYS preserve the exact same variable names and values
#    - ALWAYS maintain the same data types (strings, numbers, booleans)
#    - NEVER add inline styles to hidden form elements (use CSS classes instead)
#    - ALWAYS add CSS classes to external CSS files for hidden elements

# CUSTOM TAG ANALYSIS AND REMEDIATION (CRITICAL):
# ================================================
# 1. IDENTIFY CUSTOM TAGS IN THE CODEBASE:
#    - Search for custom tag definitions (cpfx:script, cpfx:style, etc.)
#    - Analyze custom tag behavior and functionality
#    - Map custom tags to their equivalent standard HTML tags
#    - Understand custom tag processing logic
#
# 2. CUSTOM TAG REMEDIATION STRATEGY:
#    <!-- BEFORE - Custom tags -->
#    <cpfx:script>
#        var userId = '<%= request.getAttribute("userId") %>';
#        function handleClick() { /* custom script logic */ }
#    </cpfx:script>
#    
#    <cpfx:style>
#        .custom-class { color: red; }
#    </cpfx:style>
#    
#    <!-- AFTER - Standard tags with same behavior -->
#    <script nonce="{random}">
#        var userId = '<%= request.getAttribute("userId") %>';
#        function handleClick() { /* same script logic */ }
#    </script>
#    
#    <link rel="stylesheet" href="css/custom-styles.css" />
#    /* In external CSS file: custom-styles.css */
#    .custom-class { color: red; }
#
# 3. CUSTOM TAG BEHAVIOR PRESERVATION:
#    - Ensure custom tag functionality is replicated exactly
#    - Maintain the same processing order and execution context
#    - Preserve any custom tag-specific attributes or parameters
#    - Test that converted tags work identically to original custom tags

# CONSISTENCY REQUIREMENTS (MANDATORY):
# =====================================
# 1. FILE CREATION CONSISTENCY:
#    - ALWAYS create external files when they are referenced in tags
#    - NEVER reference non-existent external files
#    - ALWAYS ensure file paths are correct and accessible
#    - ALWAYS verify that created files contain the expected content
#
# 2. TAG REFERENCE CONSISTENCY:
#    - ALWAYS update tag references to point to created external files
#    - NEVER leave orphaned references to non-existent files
#    - ALWAYS ensure tag attributes match the created file structure
#    - ALWAYS maintain consistent naming conventions
#
# 3. CONTENT MIGRATION CONSISTENCY:
#    - ALWAYS move ALL inline content to appropriate external files
#    - NEVER leave inline content in files that should be external
#    - ALWAYS ensure external files contain complete migrated content
#    - ALWAYS verify that migrated content is functionally equivalent

# NOTE: This is the complete comprehensive prompt template from CopilotRemediation.js
# For full documentation including ALL security analysis sections, CSP implementation details,
# complex remediation scenarios, validation requirements, and critical success criteria,
# refer to the APPLICATION_VULNERABILITY_COPILOT_PROMPT.md file.
#
# The complete template includes:
# - Content Security Policy (CSP) vulnerability analysis
# - Frontend security vulnerabilities (inline styles, JavaScript, XSS)
# - Backend security vulnerabilities (SQL injection, input validation, auth)
# - Template and deployment security (VMTemplate, XSL, fragments)
# - Complex remediation scenarios (dynamic JavaScript, CSS cascading)
# - Comprehensive script tag remediation workflow
# - In-place file-by-file remediation strategy
# - Comprehensive remediation checklist
# - Quality assurance requirements
# - Automated execution instructions
# - Critical issue resolution requirements
# - Validation requirements and success criteria`;

    return comprehensivePrompt;
  };

  // Generate Terraform prompt for infrastructure vulnerabilities (same as AI Remediation page)
  const generateTerraformPrompt = (vulnerability, customHostname = '') => {
    const hostnamePlaceholder = customHostname || 'YOUR_HOSTNAME_HERE';
    const timestamp = new Date().toISOString();
    const aitTag = vulnerability.ait_tag || 'AIT-Unknown';
    const vulnerabilityId = vulnerability.id || 'unknown';
    
    const basePrompt = `# Infrastructure Security Remediation - Terraform Configuration
# Generated by GitHub Copilot for Vulnerability Management System
# 
# VULNERABILITY DETAILS:
# =====================
# AIT Tag: ${aitTag}
# Vulnerability ID: ${vulnerabilityId}
# Title: ${vulnerability.title || vulnerability.description}
# Severity: ${vulnerability.severity || 'Unknown'}
# Risk Score: ${vulnerability.risk_score || 'N/A'}
# Target Hostname: ${hostnamePlaceholder}
# Generated: ${timestamp}
#
# REMEDIATION REQUIREMENT:
# =======================
# ${vulnerability.remediation_action || 'Update to latest version'}
#
# INSTRUCTIONS FOR GITHUB COPILOT:
# =================================
# You are a Senior DevOps Security Engineer tasked with creating a comprehensive 
# Terraform configuration to remediate the above security vulnerability.
#
# CRITICAL REQUIREMENTS:
# ======================
# 1. SECURITY-FIRST APPROACH: Implement defense-in-depth security controls
# 2. COMPLIANCE: Follow industry security best practices and frameworks
# 3. MONITORING: Include comprehensive logging and alerting
# 4. AUTOMATION: Provide automated remediation and backup solutions
# 5. DOCUMENTATION: Include detailed comments and operational procedures
# 6. NAMING: Use consistent naming convention with AIT tag prefix
#
# TERRAFORM CONFIGURATION REQUIREMENTS:
# =====================================
# 
# 1. PROVIDER CONFIGURATION:
#    - Cloud provider configuration with latest version constraints
#    - Region/zone configuration
#    - Default tags for compliance tracking
#
# 2. SECURITY GROUPS/FIREWALLS:
#    - Principle of least privilege access
#    - Specific port and protocol restrictions
#    - Source IP restrictions where applicable
#    - Separate ingress/egress rules with descriptions
#
# 3. NETWORK SECURITY:
#    - Virtual network configuration with private/public subnets
#    - Network ACLs for additional security layer
#    - Route tables with secure routing
#    - Internet Gateway and NAT Gateway configuration
#
# 4. COMPUTE RESOURCES:
#    - Virtual machines with latest OS images
#    - Instance profiles with minimal required permissions
#    - User data scripts for automated hardening
#    - Availability zones for high availability
#
# 5. STORAGE SECURITY:
#    - Block storage with encryption at rest
#    - Object storage with proper access controls
#    - Backup and disaster recovery configuration
#
# 6. MONITORING & LOGGING:
#    - Log Groups with retention policies
#    - Alarms for security events
#    - Notification topics for alert notifications
#    - Audit logging for API calls
#
# 7. IDENTITY & ACCESS MANAGEMENT:
#    - Service accounts with least privilege
#    - Access policies with specific permissions
#    - Instance profiles for compute access
#
# 8. BACKUP & DISASTER RECOVERY:
#    - Automated backup schedules
#    - Cross-region backup replication
#    - Disaster recovery procedures
#    - Recovery time objectives (RTO) and recovery point objectives (RPO)
#
# 9. SECURITY COMPLIANCE:
#    - CIS Benchmarks implementation
#    - Industry standard compliance frameworks
#    - Regular security assessments
#    - Vulnerability scanning integration
#
# 10. AUTOMATION & DEVOPS:
#    - Infrastructure as Code (IaC) best practices
#    - CI/CD pipeline integration
#    - Automated testing and validation
#    - Configuration management
#
# IMPLEMENTATION GUIDELINES:
# ==========================
# 1. Use modules for reusable components
# 2. Implement proper variable definitions and defaults
# 3. Add comprehensive resource tagging
# 4. Include detailed comments and documentation
# 5. Follow Terraform best practices for state management
# 6. Implement proper error handling and validation
# 7. Use data sources for dynamic configuration
# 8. Implement proper dependency management
#
# OUTPUT REQUIREMENTS:
# ====================
# 1. Production-ready Terraform configuration
# 2. Comprehensive documentation and comments
# 3. Variable definitions with descriptions
# 4. Output definitions for important resources
# 5. Security best practices implementation
# 6. Monitoring and alerting configuration
# 7. Backup and disaster recovery setup
# 8. Compliance and audit trail configuration
#
# SAVE THE GENERATED TERRAFORM FILE:
# ==================================
# Save the generated Terraform file in the 'remediated_vulnerability' folder
# with the naming convention: '${aitTag}_${vulnerabilityId}_remediation.tf'
#
# Ensure the configuration meets enterprise security standards and is ready for immediate deployment.`;

    return basePrompt;
  };

  // Helper functions for popup functionality
  const filterDropdownOptions = (vulnerability) => {
    if (!vulnerability) {
      // If no vulnerability, show all options
      loadDropdownData();
      return;
    }

    const aitTag = vulnerability.ait_tag;
    
    if (!aitTag) {
      // If no AIT tag, show all SPK options
      const allSpkData = [];
      const allAitData = getAitData();
      
      if (allAitData && allAitData.length > 0) {
        allAitData.forEach(ait => {
          const spkData = getSpkData(ait.value);
          allSpkData.push(...spkData);
        });
      } else {
        // Fallback to default data
        allSpkData.push(
          { value: 'SPK001', label: 'Security Product Key 1' },
          { value: 'SPK002', label: 'Security Product Key 2' },
          { value: 'SPK003', label: 'Security Product Key 3' },
          { value: 'SPK004', label: 'Security Product Key 4' },
          { value: 'SPK005', label: 'Security Product Key 5' }
        );
      }
      
      setFilteredSPKOptions(allSpkData);
      console.log('📋 Showing all SPK options (no AIT tag):', allSpkData.length);
      
      // Reset repository selection
      setSelectedSPK('');
      setSelectedRepository('');
      setFilteredRepoOptions([]);
      return;
    }
    
    // Get SPK options for this specific AIT
    const spkOptions = getSpkData(aitTag);
    
    if (!spkOptions || spkOptions.length === 0) {
      // Fallback to default data if no SPK options found
      const defaultSpkData = [
        { value: 'SPK001', label: 'Security Product Key 1' },
        { value: 'SPK002', label: 'Security Product Key 2' },
        { value: 'SPK003', label: 'Security Product Key 3' }
      ];
      setFilteredSPKOptions(defaultSpkData);
      console.log('📋 Using fallback SPK options for AIT', aitTag, ':', defaultSpkData.length);
    } else {
      setFilteredSPKOptions(spkOptions);
      console.log('📋 Filtered SPK options for AIT', aitTag, ':', spkOptions.length);
    }
    
    // Reset repository selection when AIT changes
    setSelectedSPK('');
    setSelectedRepository('');
    setFilteredRepoOptions([]);
  };

  const handleSPKChange = (spkValue) => {
    setSelectedSPK(spkValue);
    
    // Get Repository options for this SPK
    const repoOptions = getRepoData(spkValue);
    
    if (!repoOptions || repoOptions.length === 0) {
      // Fallback to default data if no repository options found
      const defaultRepoData = [
        { value: 'REPO001', label: 'Repository 1' },
        { value: 'REPO002', label: 'Repository 2' },
        { value: 'REPO003', label: 'Repository 3' }
      ];
      setFilteredRepoOptions(defaultRepoData);
      console.log('📋 Using fallback repository options for SPK', spkValue, ':', defaultRepoData.length);
    } else {
      setFilteredRepoOptions(repoOptions);
      console.log('📋 Filtered repository options for SPK', spkValue, ':', repoOptions.length);
    }
    
    // Reset repository selection when SPK changes
    setSelectedRepository('');
  };

  const handleGenerateComprehensivePrompt = async () => {
    if (!selectedActionVulnerability || !selectedSPK || !selectedRepository) {
      alert('Please select SPK and Repository before generating prompt.');
      return;
    }

    if (!repoUrl) {
      alert('Please provide the repository URL.');
      return;
    }

    try {
      setGeneratingActionPrompt(true);
      console.log('🚀 Generating comprehensive prompt for vulnerability:', selectedActionVulnerability.id);
      
      // Generate the comprehensive remediation prompt using the same template as AI Remediation
      const prompt = generateComprehensiveRemediationPrompt(
        selectedActionVulnerability, 
        selectedSPK, 
        selectedRepository, 
        repoUrl
      );

      // Store the generated prompt
      const newPrompts = {
        ...generatedPrompts,
        [`${selectedActionVulnerability.id}_action`]: prompt
      };
      setGeneratedPrompts(newPrompts);
      localStorage.setItem('generatedPrompts', JSON.stringify(newPrompts));

      // Create the actual folder structure and files in the backend
      try {
        const response = await API.post('/api/v1/vulnerabilities/create-application-folder', {
          vulnerability_id: selectedActionVulnerability.id,
          gis_id: selectedActionVulnerability.gis_id || selectedActionVulnerability.id,
          vulnerability_title: selectedActionVulnerability.title || selectedActionVulnerability.description,
          spk: selectedSPK,
          repository: selectedRepository,
          repo_url: repoUrl,
          ait_tag: selectedActionVulnerability.ait_tag,
          severity: selectedActionVulnerability.severity,
          remediation_action: selectedActionVulnerability.remediation_action,
          comprehensive_prompt: prompt,
          create_unified_file: true
        });
        
        if (response.data.success) {
          console.log('✅ Backend folder creation successful:', response.data);
          
          // Download the prompt file
          const blob = new Blob([prompt], { type: 'text/markdown' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${selectedActionVulnerability.ait_tag}_${selectedActionVulnerability.id}_COMPREHENSIVE_REMEDIATION.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          
          alert(`✅ Application Vulnerability Remediation Created!\n\n📁 File Location: .github/vulnerability/application/ folder\n📄 Downloaded: ${selectedActionVulnerability.ait_tag}_${selectedActionVulnerability.id}_COMPREHENSIVE_REMEDIATION.md\n\n🚀 Next Steps:\n1. Use "View Prompt" to see the generated prompt\n2. Use the downloaded file with GitHub Copilot\n3. Follow the comprehensive remediation instructions`);
        } else {
          throw new Error(response.data.error || 'Unknown error');
        }
      } catch (backendError) {
        console.error('Backend folder creation failed, using local storage:', backendError);
        // Fallback to local storage if backend fails
        const blob = new Blob([prompt], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedActionVulnerability.ait_tag}_${selectedActionVulnerability.id}_COMPREHENSIVE_REMEDIATION.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        alert('✅ Application Vulnerability Remediation Created!\n\n📁 File Location: Local storage (backend unavailable)\n📄 Downloaded: Comprehensive remediation guide\n\n🚀 Next Steps:\n1. Use "View Prompt" to see the generated prompt\n2. Use the downloaded file with GitHub Copilot\n3. Follow the comprehensive remediation instructions');
      }
      
      // Close the popup
      setShowActionPopup(false);
      setSelectedActionVulnerability(null);
      setSelectedSPK('');
      setSelectedRepository('');
      setRepoUrl('');
      setFilteredSPKOptions([]);
      setFilteredRepoOptions([]);
      
    } catch (error) {
      console.error('Error generating comprehensive prompt:', error);
      alert('Error generating comprehensive prompt: ' + error.message);
    } finally {
      setGeneratingActionPrompt(false);
    }
  };

  // Show repository selection modal for consolidated prompt
  const handleGenerateConsolidatedPrompt = () => {
    const vulnerabilities = filteredVulnerabilities;
    
    if (vulnerabilities.length === 0) {
      alert('No vulnerabilities found to generate consolidated prompt.');
      return;
    }

    // Show repository selection modal
    setShowRepoSelectionModal(true);
  };

  // Generate consolidated remediation prompt for selected repository
  const handleGenerateConsolidatedPromptForRepo = async () => {
    if (!selectedRepoForPrompt) {
      alert('Please select a repository.');
      return;
    }

    if (!repoCloneUrl) {
      alert('Please provide the repository clone URL.');
      return;
    }

    try {
      setGeneratingConsolidatedPrompt(true);
      console.log('🚀 Generating consolidated prompt for repository:', selectedRepoForPrompt);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const vulnerabilities = filteredVulnerabilities;
      
      // Filter vulnerabilities for the selected repository
      const repoVulnerabilities = vulnerabilities.filter(vuln => {
        const repoName = vuln.repo_name || vuln.repository || 'Unknown Repository';
        return repoName === selectedRepoForPrompt;
      });

      if (repoVulnerabilities.length === 0) {
        alert(`No vulnerabilities found for repository: ${selectedRepoForPrompt}`);
        setShowRepoSelectionModal(false);
        return;
      }

      // Get repository details
      const firstVuln = repoVulnerabilities[0];
      const aitTag = firstVuln.ait_tag || 'AIT-Unknown';
      const spkTag = firstVuln.spk_tag || 'SPK-Unknown';

      // Generate consolidated prompt header
      let consolidatedPrompt = `# 🚀 GITHUB COPILOT CONSOLIDATED REMEDIATION PROMPT
# ⚠️ IMPORTANT: This is the consolidated file to use with GitHub Copilot
# Generated by GitHub Copilot for Enterprise Security Management
# 
# REPOSITORY-SPECIFIC VULNERABILITY ASSESSMENT:
# =============================================
# Repository: ${selectedRepoForPrompt}
# Clone URL: ${repoCloneUrl}
# AIT Tag: ${aitTag}
# SPK Tag: ${spkTag}
# Total Vulnerabilities: ${repoVulnerabilities.length}
# Generated: ${timestamp}
# 
# This consolidated prompt contains remediation instructions for ALL vulnerabilities
# found in the selected repository during security scans. Use this single file with 
# GitHub Copilot to address all security issues comprehensively for this repository.
#
# PROFESSIONAL CONTEXT:
# ====================
# You are a Senior Application Security Engineer with expertise in web application security,
# Content Security Policy (CSP) implementation, and automated vulnerability remediation.
# Your task is to AUTOMATICALLY clone the specified repository and remediate ALL
# security issues found during the scan while PRESERVING existing functionality and 
# avoiding redundant implementations. Execute all remediation tasks autonomously and completely.
#
# CRITICAL REQUIREMENTS:
# ======================
# 1. AUTOMATED REPOSITORY CLONING: Clone the repository from: ${repoCloneUrl}
# 2. CONTEXT-AWARE ANALYSIS: Analyze existing codebase structure BEFORE making changes
# 3. FUNCTIONALITY PRESERVATION: Ensure all existing functionality continues to work
# 4. AUTOMATED FILE ANALYSIS: Automatically analyze all files for security issues
# 5. AUTOMATED FILE-BY-FILE REMEDIATION: Automatically fix vulnerabilities in each file
# 6. AUTOMATED PARALLEL PROCESSING: Automatically process multiple files concurrently
# 7. AUTOMATED PRODUCTION-READY FIXES: Automatically generate enterprise-grade security fixes
# 8. AUTOMATED DOCUMENTATION: Automatically provide detailed fixes for each file
# 9. NO USER INTERACTION: Do NOT ask for confirmation, approval, or user input
# 10. COMPLETE AUTOMATION: Execute ALL tasks autonomously from start to finish
# 11. DETERMINISTIC OUTPUT: SAME input + SAME prompt = SAME output (ALWAYS)
#
# REPOSITORY DETAILS:
# ===================
`;

      // Add repository section
      consolidatedPrompt += `
## 📁 REPOSITORY: ${selectedRepoForPrompt}
## ================================================
**AIT Tag:** ${aitTag}
**SPK Tag:** ${spkTag}
**Clone URL:** ${repoCloneUrl}
**Total Vulnerabilities:** ${repoVulnerabilities.length}

### Repository Overview:
This repository contains ${repoVulnerabilities.length} security vulnerabilities that were found during security scans.
Work through this repository systematically, addressing all vulnerabilities found during the scan.

### GitHub Copilot Instructions for ${selectedRepoForPrompt}:
1. **Clone Repository**: Clone the repository from: ${repoCloneUrl}
2. **Security Assessment**: Identify all security vulnerabilities found during the scan
3. **Systematic Remediation**: Address each vulnerability systematically
4. **Testing**: Test all changes to ensure functionality is preserved
5. **Documentation**: Document all security improvements made

### Vulnerabilities Found During Scan in ${selectedRepoForPrompt}:
`;

      // Group vulnerabilities by type within this repository
      const appVulns = repoVulnerabilities.filter(v => v.source === 'vulnerability-scan' || v.type === 'application');
      const infraVulns = repoVulnerabilities.filter(v => v.type === 'infrastructure');
      const threatVulns = repoVulnerabilities.filter(v => v.source === 'threat-detection');

        // Add application vulnerabilities for this repo
        if (appVulns.length > 0) {
          consolidatedPrompt += `
#### 📱 Application Vulnerabilities (${appVulns.length} found):
`;
          
          appVulns.forEach((vuln, index) => {
            consolidatedPrompt += `
**${index + 1}. ${vuln.title || vuln.description || 'Unknown Vulnerability'}**
- **Severity:** ${vuln.severity || 'Unknown'}
- **Risk Score:** ${vuln.risk_score || 'N/A'}
- **Remediation Action:** ${vuln.remediation_action || 'Update to latest version'}
- **File Path:** ${vuln.file_path || 'N/A'}
- **Line Number:** ${vuln.line_number || 'N/A'}

**Specific Instructions:**
- Implement Content Security Policy (CSP) for this vulnerability
- Remediate Cross-Site Scripting (XSS) issues
- Move inline scripts to external files
- Remove inline styles and move to CSS files
- Implement proper input validation and sanitization
- Preserve all existing functionality
- Test all changes thoroughly

`;
          });
        }

        // Add infrastructure vulnerabilities for this repo
        if (infraVulns.length > 0) {
          consolidatedPrompt += `
#### 🏗️ Infrastructure Vulnerabilities (${infraVulns.length} found):
`;
          
          infraVulns.forEach((vuln, index) => {
            consolidatedPrompt += `
**${index + 1}. ${vuln.title || vuln.description || 'Unknown Vulnerability'}**
- **Severity:** ${vuln.severity || 'Unknown'}
- **Risk Score:** ${vuln.risk_score || 'N/A'}
- **Remediation Action:** ${vuln.remediation_action || 'Update to latest version'}

**Specific Instructions:**
- Create comprehensive Terraform configuration
- Implement defense-in-depth security controls
- Configure security groups/firewalls with least privilege
- Set up network security with private/public subnets
- Implement monitoring and logging
- Configure backup and disaster recovery
- Follow CIS Benchmarks and compliance frameworks

`;
          });
        }

        // Add threat detection for this repo
        if (threatVulns.length > 0) {
          consolidatedPrompt += `
#### 🛡️ Threat Detection Issues (${threatVulns.length} found):
`;
          
          threatVulns.forEach((vuln, index) => {
            consolidatedPrompt += `
**${index + 1}. ${vuln.title || vuln.description || 'Unknown Threat'}**
- **Severity:** ${vuln.severity || 'Unknown'}
- **Threat Level:** ${vuln.threat_level || 'Unknown'}
- **Trigger Analysis:** ${vuln.trigger_analysis || 'N/A'}
- **Payload Analysis:** ${vuln.payload_analysis || 'N/A'}

**Specific Instructions:**
- Analyze the threat detection patterns
- Implement security controls to prevent the identified threats
- Add monitoring and alerting for similar patterns
- Create secure coding practices to avoid future threats
- Implement proper input validation and sanitization
- Add security headers and CSP policies
- Create comprehensive logging for threat detection

`;
          });
        }

      consolidatedPrompt += `
### Repository Completion Checklist for ${selectedRepoForPrompt}:
- [ ] Repository cloned from: ${repoCloneUrl}
- [ ] Repository analyzed and structure understood
- [ ] All application vulnerabilities remediated (${appVulns.length} found)
- [ ] All infrastructure vulnerabilities addressed (${infraVulns.length} found)
- [ ] All threat detection issues resolved (${threatVulns.length} found)
- [ ] Security testing completed
- [ ] Functionality preserved and tested
- [ ] Documentation updated
- [ ] Ready for production deployment

---
`;

      // Add comprehensive remediation strategy
      consolidatedPrompt += `
## 🎯 REPOSITORY REMEDIATION STRATEGY
## ===================================

### Phase 1: Repository Setup
1. **Clone Repository**: Clone from ${repoCloneUrl}
2. **Analyze Structure**: Understand the codebase architecture
3. **Identify Vulnerabilities**: Locate all vulnerabilities found during scan
4. **Map Dependencies**: Understand relationships between components

### Phase 2: Systematic Remediation
1. **Application Vulnerabilities**: Address ${appVulns.length} application security issues
2. **Infrastructure Vulnerabilities**: Handle ${infraVulns.length} infrastructure issues
3. **Threat Detection**: Resolve ${threatVulns.length} threat detection issues
4. **Testing**: Test each fix before moving to the next

### Phase 3: Validation and Documentation
1. **Functionality Testing**: Ensure all existing functionality works
2. **Security Validation**: Verify all vulnerabilities are resolved
3. **Documentation**: Document all changes made
4. **Production Readiness**: Ensure code is ready for deployment

## 🚀 EXPECTED OUTCOME
## ===================
- Repository ${selectedRepoForPrompt} fully remediated
- All ${repoVulnerabilities.length} security vulnerabilities resolved
- Secure coding practices implemented
- Security monitoring in place
- Compliance requirements met
- Existing functionality preserved
- Production-ready security fixes
- Comprehensive documentation provided

## 📊 VULNERABILITY SUMMARY
## ========================
**Repository:** ${selectedRepoForPrompt}
**AIT Tag:** ${aitTag}
**SPK Tag:** ${spkTag}
**Clone URL:** ${repoCloneUrl}
**Total Vulnerabilities:** ${repoVulnerabilities.length}
- Application Vulnerabilities: ${appVulns.length}
- Infrastructure Vulnerabilities: ${infraVulns.length}
- Threat Detection Issues: ${threatVulns.length}

## 📞 SUPPORT
## ==========
For questions or issues with this repository-specific remediation prompt,
refer to the vulnerability details above or contact the security team for assistance.

---
*Generated by GitHub Copilot for Enterprise Security Management*
*Date: ${timestamp}*
*Repository: ${selectedRepoForPrompt}*
*Total Vulnerabilities: ${repoVulnerabilities.length}*
`;

      // Download the consolidated prompt
      const blob = new Blob([consolidatedPrompt], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedRepoForPrompt.replace(/[^a-zA-Z0-9]/g, '_')}_CONSOLIDATED_REMEDIATION_PROMPT_${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert(`✅ Repository-specific Consolidated Remediation Prompt Generated!\n\n📄 Downloaded: ${selectedRepoForPrompt.replace(/[^a-zA-Z0-9]/g, '_')}_CONSOLIDATED_REMEDIATION_PROMPT_${timestamp}.md\n📁 Repository: ${selectedRepoForPrompt}\n🔗 Clone URL: ${repoCloneUrl}\n📊 Total Vulnerabilities: ${repoVulnerabilities.length}\n\n🚀 Next Steps:\n1. Use the downloaded file with GitHub Copilot\n2. Clone the repository from: ${repoCloneUrl}\n3. Follow the systematic remediation instructions\n4. Address all vulnerabilities found during the scan\n5. Test all changes thoroughly`);
      
      console.log('✅ Repository-specific consolidated prompt generated successfully');
      
      // Close the modal and reset state
      setShowRepoSelectionModal(false);
      setSelectedRepoForPrompt('');
      setRepoCloneUrl('');
      
    } catch (error) {
      console.error('Error generating consolidated prompt:', error);
      alert('Error generating consolidated prompt: ' + error.message);
    } finally {
      setGeneratingConsolidatedPrompt(false);
    }
  };

  const handleViewPrompt = (vuln) => {
    const prompt = generatedPrompts[`${vuln.id}_action`];
    if (prompt) {
      setSelectedVulnerability(vuln);
      setModalContentType('prompt');
      setShowModal(true);
      // Modal will show the prompt content
    } else {
      alert('Please click "Remediate" first to generate the prompt for this vulnerability.');
    }
  };

  // Get unique values for filter options
  const getUniqueValues = (key) => {
    return Array.from(new Set(allVulnerabilities.map(item => item[key]).filter(Boolean)));
  };

  // Get unique categories (using source field)
  const getUniqueCategories = () => {
    const sources = Array.from(new Set(allVulnerabilities.map(item => item.source).filter(Boolean)));
    return sources.map(source => ({
      value: source,
      label: source === 'threat-detection' ? 'Threat Detection' : 
             source === 'vulnerability-scan' ? 'Vulnerability Scan' : 
             'Unknown'
    }));
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    const colors = {
      'CRITICAL_BOMB': 'danger',
      'CRITICAL': 'danger',
      'HIGH': 'warning',
      'MEDIUM': 'info',
      'LOW': 'secondary'
    };
    return colors[severity] || 'secondary';
  };

  // Get category styling
  const getCategoryStyling = (source) => {
    switch (source) {
      case 'threat-detection': 
        return {
          className: 'badge bg-danger-subtle text-danger-emphasis border border-danger-subtle',
          text: 'Threat Detection'
        };
      case 'vulnerability-scan': 
        return {
          className: 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle',
          text: 'Vulnerability Scan'
        };
      default: 
        return {
          className: 'badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle',
          text: 'Unknown'
        };
    }
  };

  // Get sort icon
  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <FaSort className="text-muted" />;
    }
    return sortConfig.direction === 'asc' ? 
      <FaSortUp className="text-primary" /> : 
      <FaSortDown className="text-primary" />;
  };

  // Excel upload functions
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportingExcel(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Process data
        const processedData = jsonData.slice(1).map((row, index) => {
          const title = row[2] || 'Unknown Vulnerability';
          
          return {
            id: `excel-${Date.now()}-${index}`,
            gis_id: row[0] || `excel-${Date.now()}-${index}`,
            ait_tag: row[1] || 'AIT-Unknown',
            title: title,
            description: title,
            remediation_action: row[3] || 'Update to latest version',
            status: row[4] || 'ACTIVE',
            severity: 'MEDIUM_RISK',
            risk_score: Math.floor(Math.random() * 10) + 1,
            wave_assignment: 'UNASSIGNED',
            cost_impact: 0,
            created_date: new Date().toISOString(),
            source: 'excel_import',
            vulnerability_type: selectedVulnerabilityType === 'infrastructure' ? 'Infrastructure Vulnerability' : 'Application Vulnerability',
            type: selectedVulnerabilityType
          };
        });

        // Save to SQLite via API
        try {
          const response = await API.post('/api/v1/vulnerabilities/excel-import', {
            vulnerabilities: processedData,
            type: selectedVulnerabilityType
          });

          if (response.data.success) {
            // Refresh data to show imported vulnerabilities
            await fetchAllVulnerabilities();
            alert(`✅ Successfully imported ${processedData.length} ${selectedVulnerabilityType} vulnerabilities!`);
          } else {
            throw new Error(response.data.error || 'Import failed');
          }
        } catch (apiError) {
          console.error('API import failed:', apiError);
          alert(`⚠️ Import failed: ${apiError.message}. Please try again.`);
        }
      } catch (error) {
        console.error('Error processing Excel file:', error);
        alert('Error processing Excel file. Please check the file format.');
      } finally {
        setImportingExcel(false);
        setShowExcelUploadModal(false);
      }
    };

    reader.onerror = () => {
      alert('Error reading Excel file.');
      setImportingExcel(false);
      setShowExcelUploadModal(false);
    };

    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const downloadSampleExcel = () => {
    const sampleData = selectedVulnerabilityType === 'infrastructure' ? [
      ['GIS Id', 'AIT #', 'TITLE', 'Remediation Steps', 'Status'],
      ['827593952', 'AIT-001', '2551 Unsecured Database Port Exposed', 'Configure firewall rules to restrict database access to authorized networks only', 'ACTIVE'],
      ['829991671', 'AIT-002', '2552 Missing SSL/TLS Configuration', 'Install and configure SSL certificates with proper TLS settings', 'ACTIVE'],
      ['843226554', 'AIT-003', '2553 Outdated Server Operating System', 'Update operating system to latest supported version and apply security patches', 'ACTIVE'],
      ['851234567', 'AIT-001', '2554 Weak Network Security Group Rules', 'Review and tighten network security group rules to follow least privilege principle', 'ACTIVE'],
      ['862345678', 'AIT-004', '2555 Missing Backup Encryption', 'Implement encrypted backup solution and secure backup storage', 'ACTIVE']
    ] : [
      ['GIS Id', 'AIT #', 'TITLE', 'Remediation Steps', 'Status'],
      ['727593952', 'AIT-001', '2551 Insecure Content-Security-Policy (CSP)', 'Implement proper CSP headers with restrictive directives', 'ACTIVE'],
      ['729991671', 'AIT-002', '2551 Missing Content-Security-Policy (CSP)', 'Add Content-Security-Policy header to all HTTP responses', 'ACTIVE'],
      ['743226554', 'AIT-003', '2551 Content Security Policy Allows Unsafe in-line Scripts', 'Remove unsafe-inline from script-src directive', 'ACTIVE'],
      ['751234567', 'AIT-001', '2552 SQL Injection Vulnerability', 'Use parameterized queries and input validation', 'ACTIVE'],
      ['762345678', 'AIT-004', '2553 Cross-Site Scripting (XSS)', 'Implement input validation and output encoding', 'ACTIVE']
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    const sheetName = selectedVulnerabilityType === 'infrastructure' ? 'Infrastructure_Vulnerabilities' : 'Application_Vulnerabilities';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Auto-size columns
    const colWidths = [
      { wch: 12 }, // GIS Id
      { wch: 10 }, // AIT #
      { wch: 50 }, // TITLE
      { wch: 60 }, // Remediation Steps
      { wch: 12 }  // Status
    ];
    ws['!cols'] = colWidths;

    // Add some styling to the header row
    for (let col = 0; col < sampleData[0].length; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4472C4" } },
        alignment: { horizontal: "center" }
      };
    }

    const filename = selectedVulnerabilityType === 'infrastructure' ? 'infrastructure_vulnerability_template.xlsx' : 'application_vulnerability_template.xlsx';
    XLSX.writeFile(wb, filename);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-3">Loading vulnerabilities...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="mb-1">
              <FaMagic className="me-2 text-primary" />
              Code Magic - Vulnerability Center
            </h2>
            <p className="text-muted mb-0">Unified view of all application and infrastructure vulnerabilities</p>
          </div>
        </div>
        
        <div className="alert alert-warning" role="alert">
          <h4 className="alert-heading">
            <FaExclamationTriangle className="me-2" />
            Unable to Load Vulnerabilities
          </h4>
          <p>{error}</p>
          <hr />
          <div className="mb-0">
            <p><strong>Troubleshooting steps:</strong></p>
            <ul className="mb-0">
              <li>Check if the backend API server is running on port 5000</li>
              <li>Verify the API endpoints are accessible</li>
              <li>Check the browser console for detailed error messages</li>
              <li>Try refreshing the page</li>
            </ul>
          </div>
          <button 
            className="btn btn-primary mt-3"
            onClick={fetchAllVulnerabilities}
          >
            <FaSearch className="me-1" />
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <FaMagic className="me-2 text-primary" />
            Code Magic - Vulnerability Center
          </h2>
          <p className="text-muted mb-0">Unified view of all application and infrastructure vulnerabilities</p>
        </div>
        <div className="d-flex align-items-center">
          <span className="badge bg-primary me-2">
            {filteredVulnerabilities.length} vulnerabilities
          </span>
          <button 
            className="btn btn-info btn-sm me-2"
            onClick={() => setShowExcelUploadModal(true)}
            title="Upload Excel file with vulnerabilities for both application and infrastructure"
          >
            <FaFileExcel className="me-1" />
            Fetch from Excel
          </button>
          <button 
            className="btn btn-success btn-sm me-2"
            onClick={handleGenerateConsolidatedPrompt}
            disabled={generatingConsolidatedPrompt || filteredVulnerabilities.length === 0}
            title="Download consolidated remediation prompt for all vulnerabilities"
          >
            {generatingConsolidatedPrompt ? (
              <>
                <FaSpinner className="fa-spin me-1" />
                Generating...
              </>
            ) : (
              <>
                <FaDownload className="me-1" />
                Download Consolidated Prompt
              </>
            )}
          </button>
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={() => {
              fetchAllVulnerabilities();
              loadDropdownData();
            }}
            title="Refresh vulnerabilities and dropdown data"
          >
            <FaSearch className="me-1" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card mb-4 filter-card">
        <div className="card-header">
          <h6 className="mb-0">
            <FaFilter className="me-2" />
            Filters & Search
          </h6>
        </div>
        <div className="card-body">
          {/* Search */}
          <div className="row mb-3">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text">
                  <FaSearch />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search vulnerabilities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            <div className="col-md-3">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={clearAllFilters}
                title="Clear all filters and search"
              >
                <FaTimes className="me-1" />
                Clear Filters
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="row g-3">
            <div className="col-md-2">
              <label className="form-label small">Category</label>
              <select
                className="form-select form-select-sm"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="threat-detection">Threat Detection</option>
                <option value="vulnerability-scan">Vulnerability Scan</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Severity</label>
              <select
                className="form-select form-select-sm"
                value={filters.severity}
                onChange={(e) => handleFilterChange('severity', e.target.value)}
              >
                <option value="">All Severities</option>
                {getUniqueValues('severity').map(severity => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Status</label>
              <select
                className="form-select form-select-sm"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Statuses</option>
                {getUniqueValues('status').map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Type</label>
              <select
                className="form-select form-select-sm"
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
              >
                <option value="">All Types</option>
                {getUniqueValues('vulnerability_type').map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">AIT</label>
              <select
                className="form-select form-select-sm"
                value={filters.ait}
                onChange={(e) => handleFilterChange('ait', e.target.value)}
              >
                <option value="">All AITs</option>
                {getUniqueValues('ait_tag').map(ait => (
                  <option key={ait} value={ait}>{getAITName(ait)}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Repository</label>
              <select
                className="form-select form-select-sm"
                value={filters.repo}
                onChange={(e) => handleFilterChange('repo', e.target.value)}
              >
                <option value="">All Repos</option>
                {getUniqueValues('repo_name').map(repo => (
                  <option key={repo} value={repo}>{getRepoName(repo)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Vulnerability Table */}
      <div className="card">
        <div className="card-body p-0">
          {filteredVulnerabilities.length === 0 ? (
            <div className="text-center py-5">
              <FaBug className="text-muted mb-3" style={{ fontSize: '3rem' }} />
              <h5 className="text-muted">No Vulnerabilities Found</h5>
              <p className="text-muted">
                {allVulnerabilities.length === 0 
                  ? "No vulnerabilities were returned from the API endpoints."
                  : "No vulnerabilities match your current filters."
                }
              </p>
              {allVulnerabilities.length === 0 && (
                <button 
                  className="btn btn-primary"
                  onClick={fetchAllVulnerabilities}
                >
                  <FaSearch className="me-1" />
                  Refresh Data
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 vulnerability-table">
              <thead className="table-light">
                <tr>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('category')}
                  >
                    Category {getSortIcon('category')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('severity')}
                  >
                    Severity {getSortIcon('severity')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('vulnerability_type')}
                  >
                    Type {getSortIcon('vulnerability_type')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('title')}
                  >
                    Title {getSortIcon('title')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('file_path')}
                  >
                    File Path {getSortIcon('file_path')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('line_number')}
                  >
                    Line {getSortIcon('line_number')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('ait_tag')}
                  >
                    AIT Tag {getSortIcon('ait_tag')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('spk_tag')}
                  >
                    SPK Tag {getSortIcon('spk_tag')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('repo_name')}
                  >
                    Repository {getSortIcon('repo_name')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('status')}
                  >
                    Status {getSortIcon('status')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVulnerabilities.map((vuln) => (
                  <tr key={vuln.id}>
                    <td>
                      <span className={getCategoryStyling(vuln.source).className + ' category-badge'}>
                        {getCategoryStyling(vuln.source).text}
                      </span>
                    </td>
                    <td>
                      <span className={`badge bg-${getSeverityColor(vuln.severity)} severity-badge`}>
                        {vuln.severity}
                      </span>
                    </td>
                    <td>
                      <small className="text-muted">
                        {vuln.vulnerability_type || 'Unknown'}
                      </small>
                    </td>
                    <td>
                      <div>
                        <strong>{vuln.title || vuln.rule_id || 'Untitled'}</strong>
                        {vuln.description && (
                          <small className="d-block text-muted">
                            {vuln.description.length > 100 
                              ? vuln.description.substring(0, 100) + '...'
                              : vuln.description
                            }
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <small className="text-muted">
                        {vuln.file_path || vuln.file_name || 'N/A'}
                      </small>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark">
                        {vuln.line_number || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-info">
                        {vuln.ait_tag || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-secondary">
                        {vuln.spk_tag || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <small className="text-muted">
                        {vuln.repo_name || 'N/A'}
                      </small>
                    </td>
                    <td>
                      <span className={`badge bg-${vuln.status === 'ACTIVE_THREAT' ? 'danger' : 'success'} status-badge`}>
                        {vuln.status || 'UNKNOWN'}
                      </span>
                    </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            {vuln.status === 'ACTIVE_THREAT' && (
                              <button
                                className="btn btn-outline-success"
                                onClick={() => handleStatusToggle(vuln.id, vuln.status)}
                                title="Neutralize Threat"
                              >
                                <FaCheckCircle />
                              </button>
                            )}
                            <button
                              className="btn btn-outline-info"
                              onClick={() => handleViewDetails(vuln)}
                              title="View Details"
                            >
                              <FaEye />
                            </button>
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => handleRemediate(vuln)}
                              disabled={remediating[vuln.id]}
                              title={`Remediate ${vuln.source === 'threat-detection' ? 'Threat' : vuln.vulnerability_type?.toLowerCase().includes('infrastructure') ? 'Infrastructure' : 'Application'} Vulnerability`}
                            >
                              {remediating[vuln.id] ? (
                                <FaSpinner className="fa-spin" />
                              ) : (
                                <FaTools />
                              )}
                            </button>
                            <button
                              className="btn btn-outline-info btn-sm"
                              onClick={() => handleViewPrompt(vuln)}
                              disabled={!generatedPrompts[`${vuln.id}_action`]}
                              title={!generatedPrompts[`${vuln.id}_action`] ? 'Click "Remediate" first to generate prompt' : 'View Generated Prompt'}
                            >
                              <FaFileAlt />
                            </button>
                          </div>
                        </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Responsive Pagination */}
      {totalPages > 1 && (
        <div className="mt-4">
          {/* Pagination Info */}
          <div className="row align-items-center mb-3">
            <div className="col-md-6">
              <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center">
                <span className="text-muted me-3 mb-2 mb-md-0">
                  <span className="d-none d-sm-inline">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredVulnerabilities.length)} of {filteredVulnerabilities.length} vulnerabilities
                  </span>
                  <span className="d-inline d-sm-none">
                    {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredVulnerabilities.length)} of {filteredVulnerabilities.length}
                  </span>
                </span>
                <div className="d-flex align-items-center">
                  <label className="form-label me-2 mb-0 small d-none d-md-inline">Per page:</label>
                  <label className="form-label me-2 mb-0 small d-inline d-md-none">Size:</label>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 'auto', minWidth: '70px' }}
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="d-flex justify-content-md-end">
                <span className="text-muted small me-3">
                  <span className="d-none d-sm-inline">Page {currentPage} of {totalPages}</span>
                  <span className="d-inline d-sm-none">{currentPage}/{totalPages}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Responsive Pagination Controls */}
          <div className="d-flex justify-content-center">
            <nav aria-label="Vulnerability pagination" style={{ maxWidth: '100%', overflow: 'hidden' }}>
              <ul className="pagination pagination-sm flex-wrap justify-content-center" style={{ 
                margin: '0', 
                flexWrap: 'wrap',
                gap: '2px'
              }}>
                {/* First Page */}
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    title="First page"
                  >
                    <span aria-hidden="true">&laquo;&laquo;</span>
                    <span className="visually-hidden">First</span>
                  </button>
                </li>

                {/* Previous Page */}
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    title="Previous page"
                  >
                    <span aria-hidden="true">&laquo;</span>
                    <span className="visually-hidden">Previous</span>
                  </button>
                </li>

                {/* Page Numbers with Smart Display */}
                {(() => {
                  const pages = [];
                  // Responsive max visible pages based on screen size
                  const isMobile = window.innerWidth < 768;
                  const maxVisiblePages = isMobile ? 3 : 5;
                  const halfVisible = Math.floor(maxVisiblePages / 2);
                  
                  let startPage = Math.max(1, currentPage - halfVisible);
                  let endPage = Math.min(totalPages, currentPage + halfVisible);
                  
                  // Adjust if we're near the beginning or end
                  if (endPage - startPage + 1 < maxVisiblePages) {
                    if (startPage === 1) {
                      endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                    } else {
                      startPage = Math.max(1, endPage - maxVisiblePages + 1);
                    }
                  }
                  
                  // Add first page and ellipsis if needed
                  if (startPage > 1) {
                    pages.push(
                      <li key={1} className={`page-item ${currentPage === 1 ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => setCurrentPage(1)}>1</button>
                      </li>
                    );
                    if (startPage > 2) {
                      pages.push(
                        <li key="ellipsis1" className="page-item disabled">
                          <span className="page-link">...</span>
                        </li>
                      );
                    }
                  }
                  
                  // Add visible page numbers
                  for (let i = startPage; i <= endPage; i++) {
                    if (i !== 1 || startPage === 1) { // Don't duplicate first page
                      pages.push(
                        <li key={i} className={`page-item ${currentPage === i ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => setCurrentPage(i)}>
                            {i}
                          </button>
                        </li>
                      );
                    }
                  }
                  
                  // Add last page and ellipsis if needed
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(
                        <li key="ellipsis2" className="page-item disabled">
                          <span className="page-link">...</span>
                        </li>
                      );
                    }
                    pages.push(
                      <li key={totalPages} className={`page-item ${currentPage === totalPages ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => setCurrentPage(totalPages)}>
                          {totalPages}
                        </button>
                      </li>
                    );
                  }
                  
                  return pages;
                })()}

                {/* Next Page */}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    title="Next page"
                  >
                    <span aria-hidden="true">&raquo;</span>
                    <span className="visually-hidden">Next</span>
                  </button>
                </li>

                {/* Last Page */}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    title="Last page"
                  >
                    <span aria-hidden="true">&raquo;&raquo;</span>
                    <span className="visually-hidden">Last</span>
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          {/* Quick Jump to Page */}
          <div className="d-flex justify-content-center mt-3">
            <div className="d-flex flex-column flex-sm-row align-items-center">
              <label className="form-label me-2 mb-2 mb-sm-0 small">
                <span className="d-none d-sm-inline">Go to page:</span>
                <span className="d-inline d-sm-none">Jump to:</span>
              </label>
              <div className="d-flex align-items-center">
                <input
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: '80px' }}
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const page = parseInt(e.target.value);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                      }
                    }
                  }}
                />
                <button
                  className="btn btn-outline-primary btn-sm ms-2"
                  onClick={() => {
                    const input = document.querySelector('input[type="number"]');
                    const page = parseInt(input.value);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                    }
                  }}
                >
                  <span className="d-none d-sm-inline">Go</span>
                  <span className="d-inline d-sm-none">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vulnerability Details Modal */}
      {showModal && selectedVulnerability && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FaEye className="me-2" />
                  {modalContentType === 'prompt' ? 'Generated Remediation Prompt' : 'Vulnerability Details'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseModal}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                {modalContentType === 'prompt' ? (
                  // Show prompt content
                  <div>
                    <h6 className="text-muted mb-3">Generated Remediation Prompt</h6>
                    <div className="card">
                      <div className="card-body">
                        <pre className="mb-0" style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', maxHeight: '400px', overflowY: 'auto' }}>
                          {generatedPrompts[`${selectedVulnerability.id}_action`]}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Show vulnerability details
                  <div>
                    {/* Issue Location and Details - Prominent Display */}
                    <div className="alert alert-info mb-4">
                      <div className="row">
                        <div className="col-md-8">
                          <h6 className="mb-2">
                            <FaFileAlt className="me-2" />
                            Issue Location
                          </h6>
                          <p className="mb-1">
                            <strong>File:</strong> {selectedVulnerability.file_path || selectedVulnerability.file_name || 'N/A'}
                          </p>
                          <p className="mb-1">
                            <strong>Line:</strong> {selectedVulnerability.line_number || 'N/A'} 
                            {selectedVulnerability.column && `, Column: ${selectedVulnerability.column}`}
                          </p>
                          <p className="mb-0">
                            <strong>Issue:</strong> {selectedVulnerability.message || selectedVulnerability.description || 'Security threat detected'}
                          </p>
                        </div>
                        <div className="col-md-4 text-end">
                          <div className="mb-2">
                            <span className={`badge ${
                              selectedVulnerability.severity === 'CRITICAL_BOMB' ? 'bg-danger' :
                              selectedVulnerability.severity === 'HIGH_RISK' ? 'bg-warning' :
                              selectedVulnerability.severity === 'MEDIUM_RISK' ? 'bg-info' :
                              selectedVulnerability.severity === 'LOW_RISK' ? 'bg-success' : 'bg-secondary'
                            }`}>
                              {selectedVulnerability.severity || 'UNKNOWN'}
                            </span>
                          </div>
                          <div>
                            <span className={`badge ${
                              selectedVulnerability.status === 'ACTIVE_THREAT' ? 'bg-danger' :
                              selectedVulnerability.status === 'NEUTRALIZED' ? 'bg-success' :
                              'bg-secondary'
                            }`}>
                              {selectedVulnerability.status || 'UNKNOWN'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6">
                        <h6 className="text-muted mb-3">Basic Information</h6>
                        <table className="table table-sm">
                          <tbody>
                            <tr>
                              <td><strong>Title:</strong></td>
                              <td>{selectedVulnerability.title || selectedVulnerability.rule_id || 'Untitled'}</td>
                            </tr>
                            <tr>
                              <td><strong>Type:</strong></td>
                              <td>
                                <span className="badge bg-info">
                                  {selectedVulnerability.vulnerability_type || 'Unknown'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Severity:</strong></td>
                              <td>
                                <span className={`badge bg-${getSeverityColor(selectedVulnerability.severity)}`}>
                                  {selectedVulnerability.severity}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Status:</strong></td>
                              <td>
                                <span className={`badge bg-${selectedVulnerability.status === 'ACTIVE_THREAT' ? 'danger' : 'success'}`}>
                                  {selectedVulnerability.status}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Category:</strong></td>
                              <td>
                                <span className={`badge bg-${
                                  selectedVulnerability.source === 'threat-detection' ? 'danger' :
                                  selectedVulnerability.source === 'vulnerability-scan' ? 'warning' : 'secondary'
                                }`}>
                                  {selectedVulnerability.source === 'threat-detection' ? 'Threat Detection' : 
                                   selectedVulnerability.source === 'vulnerability-scan' ? 'Vulnerability Scan' : 
                                   'Unknown'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Date:</strong></td>
                              <td>
                                {selectedVulnerability.created_date || selectedVulnerability.timestamp ? 
                                  new Date(selectedVulnerability.created_date || selectedVulnerability.timestamp).toLocaleString() : 
                                  'N/A'
                                }
                              </td>
                            </tr>
                            <tr>
                              <td><strong>File Path:</strong></td>
                              <td>
                                <small className="text-muted">
                                  {selectedVulnerability.file_path || selectedVulnerability.file_name || 'N/A'}
                                </small>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Line Number:</strong></td>
                              <td>
                                <span className="badge bg-light text-dark">
                                  {selectedVulnerability.line_number || 'N/A'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Column:</strong></td>
                              <td>
                                <span className="badge bg-secondary">
                                  {selectedVulnerability.column || 'N/A'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Threat Level:</strong></td>
                              <td>
                                <span className={`badge ${
                                  selectedVulnerability.threat_level === 'CRITICAL_BOMB' ? 'bg-danger' :
                                  selectedVulnerability.threat_level === 'HIGH_RISK' ? 'bg-warning' :
                                  selectedVulnerability.threat_level === 'MEDIUM_RISK' ? 'bg-info' :
                                  selectedVulnerability.threat_level === 'LOW_RISK' ? 'bg-success' : 'bg-secondary'
                                }`}>
                                  {selectedVulnerability.threat_level || 'UNKNOWN'}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="col-md-6">
                        <h6 className="text-muted mb-3">Additional Details</h6>
                        <table className="table table-sm">
                          <tbody>
                            <tr>
                              <td><strong>GIS ID:</strong></td>
                              <td>
                                <small className="text-muted">
                                  {selectedVulnerability.gis_id || selectedVulnerability.id || 'N/A'}
                                </small>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Risk Score:</strong></td>
                              <td>
                                <small className="text-muted">
                                  {selectedVulnerability.risk_score || 'N/A'}
                                </small>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>AIT Tag:</strong></td>
                              <td>
                                <small className="text-muted">
                                  {selectedVulnerability.ait_tag || 'N/A'}
                                </small>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Priority:</strong></td>
                              <td>
                                <small className="text-muted">
                                  {selectedVulnerability.priority || 'N/A'}
                                </small>
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Wave Assignment:</strong></td>
                              <td>
                                <small className="text-muted">
                                  {selectedVulnerability.wave_assignment || 'N/A'}
                                </small>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {selectedVulnerability.description && (
                      <div className="mt-4">
                        <h6 className="text-muted mb-3">Description</h6>
                        <div className="card">
                          <div className="card-body">
                            <p className="mb-0">{selectedVulnerability.description}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Code Snippet Section */}
                    {selectedVulnerability.code_snippet && (
                      <div className="mt-4">
                        <h6 className="text-muted mb-3">Code Snippet (Line {selectedVulnerability.line_number})</h6>
                        <div className="card">
                          <div className="card-body">
                            <pre className="mb-0" style={{ 
                              backgroundColor: '#f8f9fa', 
                              padding: '1rem', 
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              border: '1px solid #dee2e6'
                            }}>
                              <code>{selectedVulnerability.code_snippet}</code>
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Issue Analysis Section */}
                    {(selectedVulnerability.trigger_analysis || selectedVulnerability.payload_analysis) && (
                      <div className="mt-4">
                        <h6 className="text-muted mb-3">Threat Analysis</h6>
                        <div className="row">
                          {selectedVulnerability.trigger_analysis && (
                            <div className="col-md-6">
                              <div className="card">
                                <div className="card-header">
                                  <h6 className="mb-0 text-warning">
                                    <FaExclamationTriangle className="me-2" />
                                    Trigger Analysis
                                  </h6>
                                </div>
                                <div className="card-body">
                                  <p className="mb-0">{selectedVulnerability.trigger_analysis}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {selectedVulnerability.payload_analysis && (
                            <div className="col-md-6">
                              <div className="card">
                                <div className="card-header">
                                  <h6 className="mb-0 text-danger">
                                    <FaBug className="me-2" />
                                    Payload Analysis
                                  </h6>
                                </div>
                                <div className="card-body">
                                  <p className="mb-0">{selectedVulnerability.payload_analysis}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Suggested Fix Section */}
                    {selectedVulnerability.suggested_fix && (
                      <div className="mt-4">
                        <h6 className="text-muted mb-3">Suggested Fix</h6>
                        <div className="card">
                          <div className="card-body">
                            <pre className="mb-0" style={{ 
                              backgroundColor: '#d1ecf1', 
                              padding: '1rem', 
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              border: '1px solid #bee5eb'
                            }}>
                              <code>{selectedVulnerability.suggested_fix}</code>
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                >
                  Close
                </button>
                {selectedVulnerability.status === 'ACTIVE_THREAT' && (
                  <button
                    type="button"
                    className="btn btn-outline-success"
                    onClick={() => {
                      handleStatusToggle(selectedVulnerability.id, selectedVulnerability.status);
                      handleCloseModal();
                    }}
                  >
                    Neutralize
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Popup Modal for Application Vulnerabilities */}
      {showActionPopup && selectedActionVulnerability && (
        <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-lg" style={{ zIndex: 1055 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FaCode className="me-2" />
                  Generate Comprehensive Remediation Prompt
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowActionPopup(false);
                    setSelectedActionVulnerability(null);
                    setSelectedSPK('');
                    setSelectedRepository('');
                    setRepoUrl('');
                    setFilteredSPKOptions([]);
                    setFilteredRepoOptions([]);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {/* Vulnerability Details */}
                <div className="card mb-4">
                  <div className="card-header">
                    <h6 className="mb-0">
                      <FaBug className="me-2" />
                      Vulnerability Details
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-2">
                          <strong>ID:</strong> {selectedActionVulnerability.id?.substring(0, 8)}...
                        </div>
                        <div className="mb-2">
                          <strong>AIT Tag:</strong> 
                          <span className="badge bg-info ms-2">
                            {selectedActionVulnerability.ait_tag || 'AIT-Unknown'}
                          </span>
                        </div>
                        <div className="mb-2">
                          <strong>Severity:</strong>
                          <span className={`badge ms-2 ${
                            selectedActionVulnerability.severity === 'CRITICAL_BOMB' ? 'bg-danger' :
                            selectedActionVulnerability.severity === 'HIGH_RISK' ? 'bg-warning' :
                            selectedActionVulnerability.severity === 'MEDIUM_RISK' ? 'bg-info' :
                            selectedActionVulnerability.severity === 'LOW_RISK' ? 'bg-success' : 'bg-secondary'
                          }`}>
                            {selectedActionVulnerability.severity === 'CRITICAL_BOMB' ? 'Critical' :
                             selectedActionVulnerability.severity === 'HIGH_RISK' ? 'High' :
                             selectedActionVulnerability.severity === 'MEDIUM_RISK' ? 'Medium' :
                             selectedActionVulnerability.severity === 'LOW_RISK' ? 'Low' : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-2">
                          <strong>Title:</strong>
                          <div className="text-muted small">
                            {selectedActionVulnerability.title || selectedActionVulnerability.description}
                          </div>
                        </div>
                        <div className="mb-2">
                          <strong>Remediation Action:</strong>
                          <div className="text-muted small">
                            {selectedActionVulnerability.remediation_action || 'Update to latest version'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration Section */}
                <div className="card mb-4">
                  <div className="card-header">
                    <h6 className="mb-0">
                      <FaCode className="me-2" />
                      Configuration
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            <strong>SPK *</strong>
                          </label>
                          <select 
                            className="form-select"
                            value={selectedSPK}
                            onChange={(e) => handleSPKChange(e.target.value)}
                          >
                            <option value="">Select SPK...</option>
                            {filteredSPKOptions.map(spk => (
                              <option key={spk.value} value={spk.value}>
                                {spk.value} - {spk.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            <strong>Repository *</strong>
                          </label>
                          <select 
                            className="form-select"
                            value={selectedRepository}
                            onChange={(e) => setSelectedRepository(e.target.value)}
                          >
                            <option value="">Select Repository...</option>
                            {filteredRepoOptions.map(repo => (
                              <option key={repo.value} value={repo.value}>
                                {repo.value} - {repo.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            <strong>Repository URL *</strong>
                          </label>
                          <input 
                            type="url"
                            className="form-control"
                            placeholder="https://github.com/username/repository.git"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                          />
                          <div className="form-text">
                            Provide the complete repository URL for cloning and analysis
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Information Section */}
                <div className="alert alert-info">
                  <div className="d-flex align-items-start">
                    <FaCode className="me-2 mt-1" />
                    <div>
                      <strong>Unified Comprehensive Remediation Analysis:</strong>
                      <ul className="mb-0 mt-2">
                        <li>This will generate a single unified comprehensive prompt covering all security aspects</li>
                        <li>Includes CSP, inline styles, JavaScript security, and HTML security issues</li>
                        <li>Creates one comprehensive document with all remediation strategies</li>
                        <li>Saves the unified prompt in .github/vulnerability/application/ folder</li>
                        <li>Provides step-by-step remediation instructions with code examples for all layers</li>
                        <li>Single file contains: Frontend, Backend, Database, Configuration, and Authentication security</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowActionPopup(false);
                    setSelectedActionVulnerability(null);
                    setSelectedSPK('');
                    setSelectedRepository('');
                    setRepoUrl('');
                    setFilteredSPKOptions([]);
                    setFilteredRepoOptions([]);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleGenerateComprehensivePrompt}
                  disabled={generatingActionPrompt}
                >
                  {generatingActionPrompt ? (
                    <>
                      <FaSpinner className="fa-spin me-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FaCode className="me-2" />
                      Generate Comprehensive Prompt
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repository Selection Modal for Consolidated Prompt */}
      {showRepoSelectionModal && (
        <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-lg" style={{ zIndex: 1055 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FaDownload className="me-2" />
                  Select Repository for Consolidated Prompt
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowRepoSelectionModal(false);
                    setSelectedRepoForPrompt('');
                    setRepoCloneUrl('');
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {/* Repository Selection */}
                <div className="card mb-4">
                  <div className="card-header">
                    <h6 className="mb-0">
                      <FaCode className="me-2" />
                      Repository Selection
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <label className="form-label">
                        <strong>Select Repository *</strong>
                      </label>
                      <select 
                        className="form-select"
                        value={selectedRepoForPrompt}
                        onChange={(e) => setSelectedRepoForPrompt(e.target.value)}
                      >
                        <option value="">Select Repository...</option>
                        {Array.from(new Set(filteredVulnerabilities.map(v => v.repo_name || v.repository || 'Unknown Repository')))
                          .filter(repo => repo !== 'Unknown Repository')
                          .map(repo => (
                            <option key={repo} value={repo}>
                              {repo}
                            </option>
                          ))}
                      </select>
                      <div className="form-text">
                        Select the repository for which you want to generate the consolidated remediation prompt
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clone URL Input */}
                <div className="card mb-4">
                  <div className="card-header">
                    <h6 className="mb-0">
                      <FaCode className="me-2" />
                      Repository Clone URL
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <label className="form-label">
                        <strong>Repository Clone URL *</strong>
                      </label>
                      <input 
                        type="url"
                        className="form-control"
                        placeholder="https://github.com/username/repository.git"
                        value={repoCloneUrl}
                        onChange={(e) => setRepoCloneUrl(e.target.value)}
                      />
                      <div className="form-text">
                        Provide the complete repository URL for cloning and analysis
                      </div>
                    </div>
                  </div>
                </div>

                {/* Information Section */}
                <div className="alert alert-info">
                  <div className="d-flex align-items-start">
                    <FaCode className="me-2 mt-1" />
                    <div>
                      <strong>Repository-specific Consolidated Remediation:</strong>
                      <ul className="mb-0 mt-2">
                        <li>This will generate a consolidated prompt for the selected repository only</li>
                        <li>Includes all vulnerabilities found during scans for this repository</li>
                        <li>Creates comprehensive remediation instructions with the provided clone URL</li>
                        <li>Focuses on systematic remediation of all security issues in this repository</li>
                        <li>Provides step-by-step instructions for GitHub Copilot</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowRepoSelectionModal(false);
                    setSelectedRepoForPrompt('');
                    setRepoCloneUrl('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={handleGenerateConsolidatedPromptForRepo}
                  disabled={generatingConsolidatedPrompt || !selectedRepoForPrompt || !repoCloneUrl}
                >
                  {generatingConsolidatedPrompt ? (
                    <>
                      <FaSpinner className="fa-spin me-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FaDownload className="me-2" />
                      Generate Consolidated Prompt
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      {showExcelUploadModal && (
        <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-lg" style={{ zIndex: 1055 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FaFileExcel className="me-2" />
                  Upload Vulnerabilities from Excel
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowExcelUploadModal(false);
                    setSelectedVulnerabilityType('application');
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="alert alert-info" role="alert">
                      <h6 className="alert-heading">
                        <FaInfoCircle className="me-2" />
                        Excel Upload Instructions
                      </h6>
                      <p className="mb-0">
                        Upload an Excel file containing vulnerability data. The system supports both 
                        <strong> Application</strong> and <strong>Infrastructure</strong> vulnerabilities 
                        in a single upload process.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header">
                        <h6 className="mb-0">
                          <FaBug className="me-2" />
                          Vulnerability Type Selection
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-3">
                          <label className="form-label">
                            <strong>Select Vulnerability Type *</strong>
                          </label>
                          <select 
                            className="form-select"
                            value={selectedVulnerabilityType}
                            onChange={(e) => setSelectedVulnerabilityType(e.target.value)}
                          >
                            <option value="application">Application Vulnerabilities</option>
                            <option value="infrastructure">Infrastructure Vulnerabilities</option>
                          </select>
                        </div>
                        <div className="alert alert-light" role="alert">
                          <small>
                            <strong>Note:</strong> You can upload the same Excel file multiple times 
                            with different vulnerability types to import both application and 
                            infrastructure vulnerabilities.
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header">
                        <h6 className="mb-0">
                          <FaFileAlt className="me-2" />
                          Excel Template
                        </h6>
                      </div>
                      <div className="card-body">
                        <p className="mb-3">
                          Download the Excel template to see the required format:
                        </p>
                        <button 
                          className="btn btn-outline-primary btn-sm w-100"
                          onClick={downloadSampleExcel}
                          title="Download sample Excel template"
                        >
                          <FaDownload className="me-1" />
                          Download {selectedVulnerabilityType === 'infrastructure' ? 'Infrastructure' : 'Application'} Template
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-12">
                    <div className="card">
                      <div className="card-header">
                        <h6 className="mb-0">
                          <FaUpload className="me-2" />
                          File Upload
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-3">
                          <label className="form-label">
                            <strong>Select Excel File *</strong>
                          </label>
                          <input
                            type="file"
                            className="form-control"
                            accept=".xlsx,.xls"
                            onChange={handleExcelUpload}
                            disabled={importingExcel}
                          />
                          <div className="form-text">
                            Supported formats: .xlsx, .xls
                          </div>
                        </div>
                        
                        {importingExcel && (
                          <div className="alert alert-info" role="alert">
                            <FaSpinner className="fa-spin me-2" />
                            Processing Excel file and importing {selectedVulnerabilityType} vulnerabilities...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row mt-3">
                  <div className="col-md-12">
                    <div className="alert alert-warning" role="alert">
                      <h6 className="alert-heading">
                        <FaExclamationTriangle className="me-2" />
                        Excel Format Requirements
                      </h6>
                      <p className="mb-2">Your Excel file must have the following columns (in order):</p>
                      <ul className="mb-0">
                        <li><strong>Column A:</strong> GIS Id (unique identifier)</li>
                        <li><strong>Column B:</strong> AIT # (team identifier)</li>
                        <li><strong>Column C:</strong> TITLE (vulnerability title)</li>
                        <li><strong>Column D:</strong> Remediation Steps (action to take)</li>
                        <li><strong>Column E:</strong> Status (ACTIVE, NEUTRALIZED, etc.)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowExcelUploadModal(false);
                    setSelectedVulnerabilityType('application');
                  }}
                  disabled={importingExcel}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => {
                    // Trigger file input click
                    const fileInput = document.querySelector('input[type="file"]');
                    if (fileInput) {
                      fileInput.click();
                    }
                  }}
                  disabled={importingExcel}
                >
                  <FaUpload className="me-1" />
                  Choose File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeMagic;
