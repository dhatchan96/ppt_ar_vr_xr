import React, { useState, useEffect } from 'react';
import { copilotAPI, vscodeAgentAPI, vscodeCopilotAPI } from '../api';
import API from '../api';
import './CopilotRemediation.css';
import { getAITName, getSPKName, getRepoName, getSpkData, getRepoData } from '../config/dropdownData';
import JSZip from 'jszip';

// Helper function to get file name from path
const Path = (path) => {
  return path.split('/').pop() || path.split('\\').pop() || path;
};

const CopilotRemediation = () => {
  const [projects, setProjects] = useState([]);
  const [agentStatus, setAgentStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContents, setFileContents] = useState(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [processingScan, setProcessingScan] = useState(null);
  const [vscodePrompts, setVscodePrompts] = useState({});
  const [showVscodeModal, setShowVscodeModal] = useState(false);
  const [selectedVscodeFile, setSelectedVscodeFile] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [selectedScanId, setSelectedScanId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [taskDetails, setTaskDetails] = useState({});
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [instructions, setInstructions] = useState({});
  const [workspaceData, setWorkspaceData] = useState({});
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [copilotPrompts, setCopilotPrompts] = useState({});
  const [showCopilotPromptsModal, setShowCopilotPromptsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');
  const [activeVulnSubTab, setActiveVulnSubTab] = useState('application');
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [infrastructureVulnerabilities, setInfrastructureVulnerabilities] = useState([]);
  const [vulnerabilitiesLoading, setVulnerabilitiesLoading] = useState(false);
  
  // Filter states for vulnerability tables
  const [vulnSearchFilter, setVulnSearchFilter] = useState('');
  const [vulnSeverityFilter, setVulnSeverityFilter] = useState('');
  const [vulnAitFilter, setVulnAitFilter] = useState('');
  const [infraSearchFilter, setInfraSearchFilter] = useState('');
  const [infraSeverityFilter, setInfraSeverityFilter] = useState('');
  const [infraAitFilter, setInfraAitFilter] = useState('');
  const [generatedPrompts, setGeneratedPrompts] = useState(() => {
    // Load generated prompts from localStorage on component mount
    const saved = localStorage.getItem('generatedPrompts');
    return saved ? JSON.parse(saved) : {};
  });
  const [showTerraformModal, setShowTerraformModal] = useState(false);
  const [terraformContent, setTerraformContent] = useState('');
  const [generatingTerraform, setGeneratingTerraform] = useState(false);
  const [creatingActionPrompt, setCreatingActionPrompt] = useState({});
  const [hostname, setHostname] = useState('');
  const [currentVulnerability, setCurrentVulnerability] = useState(null);
  const [githubFolderStatus, setGithubFolderStatus] = useState(null);
  const [remediatedFolderStatus, setRemediatedFolderStatus] = useState(null);
  const [showActionPopup, setShowActionPopup] = useState(false);
  const [selectedActionVulnerability, setSelectedActionVulnerability] = useState(null);
  const [selectedSPK, setSelectedSPK] = useState('');
  const [selectedRepository, setSelectedRepository] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [generatingActionPrompt, setGeneratingActionPrompt] = useState(false);
  const [filteredSPKOptions, setFilteredSPKOptions] = useState([]);
  const [filteredRepoOptions, setFilteredRepoOptions] = useState([]);
  
  // Sorting state
  const [sortField, setSortField] = useState(null);
  const [sortDirection] = useState('asc');

  useEffect(() => {
    loadProjects();
    loadAgentStatus();
  }, [refreshTrigger]);

  useEffect(() => {
    if (activeTab === 'vulnerabilities') {
      // Clean up old Excel data first, then load vulnerabilities
      cleanupOldExcelData();
      loadVulnerabilities();
      checkGithubFolderStatus();
    }
  }, [activeTab]);

  // Initialize dropdown data on component mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        const { initializeDropdownData } = await import('../config/dropdownData');
        await initializeDropdownData();
      } catch (error) {
        console.error('Error initializing dropdown data:', error);
      }
    };
    initializeData();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading projects...');
      const response = await copilotAPI.getProjects();
      console.log('📦 Projects API response:', response);
      console.log('📦 Projects data:', response.data);
      console.log('📦 Projects array:', response.data?.projects);
      setProjects(response.data?.projects || []);
      console.log('✅ Projects loaded:', response.data?.projects?.length || 0, 'projects');
    } catch (error) {
      console.error('❌ Error loading projects:', error);
      console.error('❌ Error details:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentStatus = async () => {
    try {
      const status = await copilotAPI.getAgentStatus();
      setAgentStatus(status);
    } catch (error) {
      console.error('Error loading agent status:', error);
    }
  };

  // Load sample infrastructure vulnerabilities
  const loadSampleInfrastructureVulnerabilities = () => {
    const sampleInfrastructureVulns = [
      {
        id: 'infra-001',
        gis_id: '827593952',
        ait_tag: 'AIT-001',
        title: '2551 Unsecured Database Port Exposed',
        description: 'Database port 3306 is exposed to public network without proper firewall rules',
        remediation_action: 'Configure firewall rules to restrict database access to authorized networks only',
        status: 'ACTIVE',
        severity: 'HIGH_RISK',
        risk_score: 8,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      },
      {
        id: 'infra-002',
        gis_id: '829991671',
        ait_tag: 'AIT-002',
        title: '2552 Missing SSL/TLS Configuration',
        description: 'Web server is not configured with proper SSL/TLS encryption',
        remediation_action: 'Install and configure SSL certificates with proper TLS settings',
        status: 'ACTIVE',
        severity: 'CRITICAL_BOMB',
        risk_score: 9,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      },
      {
        id: 'infra-003',
        gis_id: '843226554',
        ait_tag: 'AIT-003',
        title: '2553 Outdated Server Operating System',
        description: 'Server is running outdated OS version with known security vulnerabilities',
        remediation_action: 'Update operating system to latest supported version and apply security patches',
        status: 'ACTIVE',
        severity: 'HIGH_RISK',
        risk_score: 7,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      },
      {
        id: 'infra-004',
        gis_id: '851234567',
        ait_tag: 'AIT-001',
        title: '2554 Weak Network Security Group Rules',
        description: 'Network security groups allow overly permissive inbound traffic',
        remediation_action: 'Review and tighten network security group rules to follow least privilege principle',
        status: 'ACTIVE',
        severity: 'MEDIUM_RISK',
        risk_score: 6,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      },
      {
        id: 'infra-005',
        gis_id: '862345678',
        ait_tag: 'AIT-004',
        title: '2555 Missing Backup Encryption',
        description: 'Database backups are not encrypted and stored in unsecured location',
        remediation_action: 'Implement encrypted backup solution and secure backup storage',
        status: 'ACTIVE',
        severity: 'HIGH_RISK',
        risk_score: 8,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      }
    ];
    setInfrastructureVulnerabilities(sampleInfrastructureVulns);
    console.log('✅ Loaded sample infrastructure vulnerabilities');
  };

  const loadVulnerabilities = async () => {
    try {
      setVulnerabilitiesLoading(true);
      console.log('🔄 Loading vulnerabilities...');
      
      // Use the same API approach as EnhancedVulnerabilityManagement
      let apiVulnerabilities = [];
      try {
        const response = await API.get('/api/v1/vulnerabilities/enhanced?page=1&per_page=100');
        const data = response.data;
        
        if (data.success) {
          apiVulnerabilities = data.vulnerabilities || [];
          console.log('✅ API Vulnerabilities loaded:', apiVulnerabilities.length, 'vulnerabilities');
          
          // Log details about the vulnerabilities
          const scanResults = apiVulnerabilities.filter(v => v.source === 'scan_result');
          const sampleData = apiVulnerabilities.filter(v => !v.source || v.source !== 'scan_result');
          console.log('📊 Breakdown:', {
            total: apiVulnerabilities.length,
            scanResults: scanResults.length,
            sampleData: sampleData.length
          });
          
          if (scanResults.length > 0) {
            console.log('🔍 Sample scan result:', scanResults[0]);
          }
        } else {
          console.error('❌ Error loading API vulnerabilities:', data.error);
        }
      } catch (apiError) {
        console.error('❌ Error loading API vulnerabilities:', apiError);
      }
      
      // Load any persisted Excel data from localStorage and merge with API data
      const persistedExcelData = localStorage.getItem('excel_vulnerabilities');
      if (persistedExcelData) {
        try {
          const parsedExcelData = JSON.parse(persistedExcelData);
          console.log('✅ Excel data loaded:', parsedExcelData.length, 'vulnerabilities');
          
          // Merge API data with Excel data, avoiding duplicates
          const existingIds = new Set(apiVulnerabilities.map(v => v.id));
          const newExcelVulns = parsedExcelData.filter(v => !existingIds.has(v.id));
          const mergedVulnerabilities = [...apiVulnerabilities, ...newExcelVulns];
          
          setVulnerabilities(mergedVulnerabilities);
          console.log(`✅ Total vulnerabilities loaded: ${apiVulnerabilities.length} API + ${parsedExcelData.length} Excel (${newExcelVulns.length} new) = ${mergedVulnerabilities.length} total`);
        } catch (error) {
          console.error('❌ Error loading persisted Excel data:', error);
          localStorage.removeItem('excel_vulnerabilities');
          setVulnerabilities(apiVulnerabilities);
        }
      } else {
        setVulnerabilities(apiVulnerabilities);
      }
      
      // If no API data and no Excel data, set empty array
      if (apiVulnerabilities.length === 0 && !persistedExcelData) {
        setVulnerabilities([]);
      }
      
      // Load persisted infrastructure vulnerabilities from localStorage first
      const persistedInfraData = localStorage.getItem('infrastructure_vulnerabilities');
      if (persistedInfraData) {
        try {
          const parsedInfraData = JSON.parse(persistedInfraData);
          setInfrastructureVulnerabilities(parsedInfraData);
          console.log(`✅ Loaded ${parsedInfraData.length} persisted infrastructure vulnerabilities`);
        } catch (error) {
          console.error('❌ Error loading persisted infrastructure data:', error);
          localStorage.removeItem('infrastructure_vulnerabilities');
          // Don't load sample data - start with empty array
          setInfrastructureVulnerabilities([]);
        }
      } else {
        // Don't load sample data by default - start with empty array
        setInfrastructureVulnerabilities([]);
      }
      
    } catch (error) {
      console.error('❌ Error in loadVulnerabilities:', error);
      setVulnerabilities([]);
    } finally {
      setVulnerabilitiesLoading(false);
    }
  };

  // Clean up old Excel data with excel- prefix
  const cleanupOldExcelData = () => {
    const persistedExcelData = localStorage.getItem('excel_vulnerabilities');
    if (persistedExcelData) {
      try {
        const parsedExcelData = JSON.parse(persistedExcelData);
        const cleanedData = parsedExcelData.map(vuln => {
          if (vuln.id && vuln.id.startsWith('excel-')) {
            // Convert excel- prefix to vuln- prefix
            return {
              ...vuln,
              id: vuln.id.replace('excel-', 'vuln-')
            };
          }
          return vuln;
        });
        
        localStorage.setItem('excel_vulnerabilities', JSON.stringify(cleanedData));
        console.log('✅ Cleaned up old Excel data with excel- prefix');
        
        // Reload vulnerabilities to reflect the changes
        loadVulnerabilities();
      } catch (error) {
        console.error('❌ Error cleaning up old Excel data:', error);
      }
    }
  };

  // Clean up old application vulnerability files
  const cleanupApplicationFiles = async () => {
    try {
      const response = await API.post('/api/v1/vulnerabilities/cleanup-application-files', {});
      
      if (response.data.success) {
        const filesRemoved = response.data.files_removed || [];
        if (filesRemoved.length > 0) {
          alert(`✅ Cleanup completed successfully!\n\nRemoved ${filesRemoved.length} old files:\n${filesRemoved.join('\n')}`);
        } else {
          alert('✅ Cleanup completed! No old files found to remove.');
        }
      } else {
        throw new Error(response.data.error || 'Cleanup failed');
      }
    } catch (error) {
      console.error('Error cleaning up application files:', error);
      alert('❌ Error cleaning up files: ' + (error.response?.data?.error || error.message));
    }
  };

  // Clear all vulnerability data for AI remediation
  const clearAllVulnerabilities = () => {
    const isInfrastructure = activeVulnSubTab === 'infrastructure';
    const tabType = isInfrastructure ? 'infrastructure' : 'application';
    
    if (!window.confirm(`Are you sure you want to clear ALL ${tabType} vulnerability records from AI Remediation? This action cannot be undone.`)) {
      return;
    }
    
    // Clear vulnerability data based on current sub-tab
    if (isInfrastructure) {
      setInfrastructureVulnerabilities([]);
      localStorage.removeItem('infrastructure_vulnerabilities');
    } else {
      setVulnerabilities([]);
      localStorage.removeItem('excel_vulnerabilities');
    }
    
    // Clear generated prompts for the current tab
    const currentPrompts = { ...generatedPrompts };
    Object.keys(currentPrompts).forEach(key => {
      if (isInfrastructure) {
        // Clear infrastructure-related prompts
        if (key.includes('_action') || key.includes('infra-')) {
          delete currentPrompts[key];
        }
      } else {
        // Clear application-related prompts
        if (key.includes('_comprehensive') || key.includes('vuln-')) {
          delete currentPrompts[key];
        }
      }
    });
    setGeneratedPrompts(currentPrompts);
    localStorage.setItem('generatedPrompts', JSON.stringify(currentPrompts));
    
    // Clear any action popup state
    setShowActionPopup(false);
    setSelectedActionVulnerability(null);
    setSelectedSPK('');
    setSelectedRepository('');
    setRepoUrl('');
    setFilteredSPKOptions([]);
    setFilteredRepoOptions([]);
    
    alert(`All ${tabType} vulnerability records have been cleared successfully from AI Remediation!`);
  };

  // Filter functions for vulnerability tables
  const filterVulnerabilities = (vulns, searchFilter, severityFilter, aitFilter) => {
    return vulns.filter(vuln => {
      const matchesSearch = !searchFilter || 
        vuln.id?.toString().toLowerCase().includes(searchFilter.toLowerCase()) ||
        vuln.gis_id?.toString().toLowerCase().includes(searchFilter.toLowerCase()) ||
        vuln.title?.toString().toLowerCase().includes(searchFilter.toLowerCase()) ||
        vuln.description?.toString().toLowerCase().includes(searchFilter.toLowerCase()) ||
        vuln.remediation_action?.toString().toLowerCase().includes(searchFilter.toLowerCase());
      
      const matchesSeverity = !severityFilter || vuln.severity === severityFilter;
      const matchesAit = !aitFilter || vuln.ait_tag === aitFilter;
      
      return matchesSearch && matchesSeverity && matchesAit;
    });
  };

  // Get unique values for filter dropdowns
  const getUniqueSeverities = (vulns) => {
    const severities = [...new Set(vulns.map(v => v.severity).filter(Boolean))];
    return severities.sort();
  };

  const getUniqueAitTags = (vulns) => {
    const aitTags = [...new Set(vulns.map(v => v.ait_tag).filter(Boolean))];
    return aitTags.sort();
  };

  // Clear filters
  const clearVulnFilters = () => {
    setVulnSearchFilter('');
    setVulnSeverityFilter('');
    setVulnAitFilter('');
  };

  const clearInfraFilters = () => {
    setInfraSearchFilter('');
    setInfraSeverityFilter('');
    setInfraAitFilter('');
  };

  // Format ID for display
  const formatVulnerabilityId = (id) => {
    if (!id) return 'Unknown';
    
    // For vuln- prefixed IDs, show a cleaner format
    if (id.includes('vuln-')) {
      const parts = id.split('-');
      if (parts.length >= 3) {
        // Extract timestamp and index: vuln-1234567890-1 -> 1234567890-1
        return `${parts[1]}-${parts[2]}`;
      }
    }
    
    // For other IDs, show first 12 characters
    return id.substring(0, 12);
  };

  // Load sample infrastructure data for AI Remediation
  const loadSampleInfrastructureData = () => {
    if (!window.confirm('Load sample infrastructure vulnerability data? This will replace any existing data.')) {
      return;
    }
    
    const sampleInfrastructureVulns = [
      {
        id: 'infra-001',
        gis_id: '827593952',
        ait_tag: 'AIT-001',
        title: '2551 Unsecured Database Port Exposed',
        description: 'Database port 3306 is exposed to public network without proper firewall rules',
        remediation_action: 'Configure firewall rules to restrict database access to authorized networks only',
        status: 'ACTIVE',
        severity: 'HIGH_RISK',
        risk_score: 8,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      },
      {
        id: 'infra-002',
        gis_id: '829991671',
        ait_tag: 'AIT-002',
        title: '2552 Missing SSL/TLS Configuration',
        description: 'Web server is not configured with proper SSL/TLS encryption',
        remediation_action: 'Install and configure SSL certificates with proper TLS settings',
        status: 'ACTIVE',
        severity: 'CRITICAL_BOMB',
        risk_score: 9,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      },
      {
        id: 'infra-003',
        gis_id: '843226554',
        ait_tag: 'AIT-003',
        title: '2553 Outdated Server Operating System',
        description: 'Server is running outdated OS version with known security vulnerabilities',
        remediation_action: 'Update operating system to latest supported version and apply security patches',
        status: 'ACTIVE',
        severity: 'HIGH_RISK',
        risk_score: 7,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      },
      {
        id: 'infra-004',
        gis_id: '851234567',
        ait_tag: 'AIT-001',
        title: '2554 Weak Network Security Group Rules',
        description: 'Network security groups allow overly permissive inbound traffic',
        remediation_action: 'Review and tighten network security group rules to follow least privilege principle',
        status: 'ACTIVE',
        severity: 'MEDIUM_RISK',
        risk_score: 6,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      },
      {
        id: 'infra-005',
        gis_id: '862345678',
        ait_tag: 'AIT-004',
        title: '2555 Missing Backup Encryption',
        description: 'Database backups are not encrypted and stored in unsecured location',
        remediation_action: 'Implement encrypted backup solution and secure backup storage',
        status: 'ACTIVE',
        severity: 'HIGH_RISK',
        risk_score: 8,
        wave_assignment: 'UNASSIGNED',
        cost_impact: 0,
        created_date: new Date().toISOString(),
        source: 'infrastructure_scan'
      }
    ];
    
    setInfrastructureVulnerabilities(sampleInfrastructureVulns);
    localStorage.setItem('infrastructure_vulnerabilities', JSON.stringify(sampleInfrastructureVulns));
    alert('Sample infrastructure vulnerability data loaded successfully!');
  };

  // Vulnerability-specific functions
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
#    - Point-in-time recovery capabilities
#
# 9. COMPLIANCE & TAGGING:
#    - Comprehensive resource tagging
#    - Compliance-related tags (AIT, Environment, Owner)
#    - Cost allocation tags
#
# 10. OPERATIONAL PROCEDURES:
#     - Health check configurations
#     - Auto-scaling groups for high availability
#     - Load balancer configuration
#     - SSL/TLS certificate management
#
# SECURITY HARDENING CHECKLIST:
# =============================
# - [ ] All ports are explicitly defined and restricted
# - [ ] Security groups follow least privilege principle
# - [ ] Encryption is enabled for all data at rest
# - [ ] Encryption is enabled for all data in transit
# - [ ] Logging is enabled for all security-relevant services
# - [ ] Monitoring and alerting is configured
# - [ ] Backup and recovery procedures are automated
# - [ ] Access controls are properly configured
# - [ ] Network segmentation is implemented
# - [ ] Compliance requirements are met
#
# OUTPUT REQUIREMENTS:
# ===================
# Generate a complete, production-ready Terraform configuration that:
# 1. Addresses the specific vulnerability mentioned above
# 2. Implements the remediation action specified
# 3. Follows cloud security best practices
# 4. Includes comprehensive monitoring and alerting
# 5. Provides automated backup and recovery solutions
# 6. Uses proper resource naming with AIT tag prefix
# 7. Includes detailed documentation in comments
# 8. Configures the target hostname as specified
# 9. Is ready for immediate deployment
# 10. Meets enterprise security standards
#
# FILE LOCATION:
# ==============
# Save the generated Terraform file in the 'remediated_vulnerability' folder
# with the naming convention: '${aitTag}_${vulnerabilityId}_remediation.tf'
#
# EXPECTED DELIVERABLES:
# =====================
# 1. Complete Terraform configuration file (.tf)
# 2. Comprehensive resource documentation
# 3. Security controls implementation
# 4. Monitoring and alerting setup
# 5. Backup and recovery configuration
# 6. Compliance and tagging implementation
#
# Please generate the complete Terraform configuration now and save it to the specified location.
# Ensure the configuration is production-ready and follows all security best practices.`;

    return basePrompt;
  };

  const generateActionPrompt = (vulnerability) => {
    const timestamp = new Date().toISOString();
    const aitTag = vulnerability.ait_tag || 'AIT-Unknown';
    const vulnerabilityId = vulnerability.id || 'unknown';
    
    const actionPrompt = `# Infrastructure Security Remediation - Professional Terraform Configuration
# Generated by GitHub Copilot for Enterprise Vulnerability Management
# 
# VULNERABILITY ASSESSMENT:
# =========================
# AIT Tag: ${aitTag}
# Vulnerability ID: ${vulnerabilityId}
# Title: ${vulnerability.title || vulnerability.description}
# Severity: ${vulnerability.severity || 'Unknown'}
# Risk Score: ${vulnerability.risk_score || 'N/A'}
# Generated: ${timestamp}
#
# REMEDIATION OBJECTIVE:
# =====================
# ${vulnerability.remediation_action || 'Update to latest version'}
#
# PROFESSIONAL CONTEXT:
# ====================
# You are a Senior Cloud Security Architect with expertise in cloud infrastructure,
# Terraform automation, and enterprise security compliance. Your task is to create
# a comprehensive, production-ready Terraform configuration that addresses the
# security vulnerability above while implementing enterprise-grade security controls.
#
# ENTERPRISE SECURITY REQUIREMENTS:
# =================================
# 1. DEFENSE IN DEPTH: Implement multiple layers of security controls
# 2. COMPLIANCE: Meet SOC 2, ISO 27001, and industry security standards
# 3. MONITORING: Comprehensive observability and incident response
# 4. AUTOMATION: Infrastructure as Code with automated security scanning
# 5. DOCUMENTATION: Detailed operational runbooks and procedures
# 6. GOVERNANCE: Proper resource tagging and cost management
#
# TERRAFORM ARCHITECTURE REQUIREMENTS:
# ====================================
# 
# SECURITY FOUNDATION:
# - Virtual network with private/public subnet architecture
# - Security groups with least privilege access
# - Network ACLs for additional security layer
# - Web Application Firewall rules for application protection
# - DDoS protection services
#
# IDENTITY & ACCESS MANAGEMENT:
# - Service accounts with minimal required permissions
# - Access policies with specific resource restrictions
# - Service-linked roles for cloud services
# - Cross-account access controls
#
# DATA PROTECTION:
# - Encryption at rest using cloud key management
# - Encryption in transit with TLS 1.3
# - Data classification and handling procedures
# - Backup encryption and key rotation
#
# MONITORING & LOGGING:
# - Comprehensive logging services
# - API call auditing and tracking
# - Threat detection and monitoring
# - Compliance monitoring and reporting
# - Alert management and notification systems
#
# BACKUP & DISASTER RECOVERY:
# - Automated backup schedules
# - Cross-region replication
# - Point-in-time recovery
# - RTO/RPO compliance
#
# COMPLIANCE & GOVERNANCE:
# - Resource tagging for compliance tracking
# - Cost allocation and optimization
# - Change management procedures
# - Audit trail maintenance
#
# OPERATIONAL EXCELLENCE:
# - Health checks and auto-scaling
# - Load balancing and high availability
# - SSL/TLS certificate management
# - Performance monitoring
#
# SECURITY HARDENING CHECKLIST:
# =============================
# - [ ] Network segmentation implemented
# - [ ] Least privilege access controls
# - [ ] Encryption enabled for all data
# - [ ] Logging enabled for all services
# - [ ] Monitoring and alerting configured
# - [ ] Backup and recovery automated
# - [ ] Compliance requirements met
# - [ ] Security scanning integrated
# - [ ] Incident response procedures
# - [ ] Change management controls
#
# DELIVERABLE SPECIFICATIONS:
# ==========================
# Generate a complete Terraform configuration that includes:
# 1. Provider configuration with version constraints
# 2. Virtual network and networking infrastructure
# 3. Security groups and network ACLs
# 4. Compute resources with security hardening
# 5. Storage with encryption and backup
# 6. Monitoring and logging setup
# 7. Service accounts and access policies
# 8. Backup and disaster recovery
# 9. Compliance and tagging
# 10. Operational procedures
#
# FILE SPECIFICATIONS:
# ===================
# - Filename: '${aitTag}_${vulnerabilityId}_remediation.tf'
# - Location: 'remediated_vulnerability' folder
# - Format: Production-ready Terraform configuration
# - Documentation: Comprehensive inline comments
# - Standards: Enterprise security compliance
#
# QUALITY ASSURANCE:
# =================
# The generated configuration must be:
# - Production-ready and tested
# - Security-hardened and compliant
# - Well-documented and maintainable
# - Cost-optimized and scalable
# - Audit-ready and traceable
#
# Please generate the complete Terraform configuration now and save it to the specified location.
# Ensure the configuration meets enterprise security standards and is ready for immediate deployment.`;

    return actionPrompt;
  };

  const handleRunTerraform = async (vulnerability) => {
    try {
      setGeneratingTerraform(true);
      const prompt = generateTerraformPrompt(vulnerability);
      
      // Store the generated prompt for this vulnerability
      const newPrompts = {
        ...generatedPrompts,
        [vulnerability.id]: prompt
      };
      setGeneratedPrompts(newPrompts);
      // Save to localStorage for persistence
      localStorage.setItem('generatedPrompts', JSON.stringify(newPrompts));
      
      // Show success message
      alert('GitHub Copilot prompt generated successfully! Click "View Prompt" to see the prompt.');
    } catch (error) {
      console.error('Error generating prompt:', error);
      alert('Error generating prompt: ' + error.message);
    } finally {
      setGeneratingTerraform(false);
    }
  };

  const handleViewTerraformPrompt = (vulnerability) => {
    // Check if prompt has been generated for this vulnerability
    const prompt = generatedPrompts[vulnerability.id];
    if (prompt) {
      setCurrentVulnerability(vulnerability);
      setTerraformContent(prompt);
      setHostname(''); // Reset hostname for new vulnerability
      setShowTerraformModal(true);
    } else {
      alert('Please click "Run" first to create the GitHub Copilot prompt for this vulnerability.');
    }
  };

  const generateComprehensiveRemediationPrompt = (vulnerability, spk, repository, repoUrl) => {
    const timestamp = new Date().toISOString().split('T')[0];
    const aitTag = vulnerability.ait_tag || 'AIT-Unknown';
    const vulnerabilityId = vulnerability.id || 'unknown';
    
    // Enhanced comprehensive prompt with specific CSP vulnerability focus
    const comprehensivePrompt = `# Application Security Remediation - Comprehensive CSP Vulnerability Fix
# Generated by GitHub Copilot for Enterprise Security Management
# 
# VULNERABILITY ASSESSMENT:
# =========================
# AIT Tag: ${aitTag}
# Vulnerability ID: ${vulnerabilityId}
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
# ${vulnerability.remediation_action || 'Implement comprehensive Content Security Policy (CSP) and fix all security vulnerabilities'}
#
# PROFESSIONAL CONTEXT:
# ====================
# You are a Senior Application Security Engineer with expertise in web application security,
# Content Security Policy (CSP) implementation, and enterprise vulnerability remediation.
# Your task is to clone the specified repository, perform comprehensive security analysis,
# and generate detailed remediation strategies for all identified security vulnerabilities.
#
# CRITICAL REQUIREMENTS:
# ======================
# 1. REPOSITORY CLONING: Clone the repository from the provided URL
# 2. COMPREHENSIVE SCANNING: Scan all folders and files for security issues
# 3. CSP IMPLEMENTATION: Focus on Content Security Policy vulnerabilities
# 4. FOLDER-WISE ANALYSIS: Create separate remediation for each application layer
# 5. PRODUCTION-READY: Generate enterprise-grade security fixes
# 6. DOCUMENTATION: Provide detailed implementation guides
#
# REPOSITORY CLONING INSTRUCTIONS:
# ================================
# 1. Clone the repository: git clone ${repoUrl}
# 2. Navigate to the repository directory
# 3. Perform comprehensive security scan of all files
# 4. Identify all instances of security vulnerabilities
# 5. Create detailed analysis report for each folder

# CONTENT SECURITY POLICY (CSP) VULNERABILITY ANALYSIS:
# ====================================================
#
# PRIMARY CSP ISSUES TO IDENTIFY AND FIX:
# ---------------------------------------
# 1. WILDCARD HOST LISTS:
#    - Remove wildcards (*) from CSP directives
#    - Replace with specific, trusted domains
#    - Implement strict host validation
#
# 2. UNSAFE-INLINE DIRECTIVES:
#    - Replace 'unsafe-inline' with nonces or hashes
#    - Generate unique nonces for each request
#    - Use SHA-256 hashes for inline scripts/styles
#
# 3. UNSAFE-EVAL FOR SCRIPT-SRC:
#    - Remove 'unsafe-eval' from script-src directive
#    - Replace eval() statements with static code
#    - Use Function constructor alternatives
#
# 4. MISSING CSP HEADERS:
#    - Add proper CSP headers to all HTTP responses
#    - Implement Content-Security-Policy header
#    - Add Content-Security-Policy-Report-Only for testing
#
# 5. LOOSE CSP DIRECTIVES:
#    - Tighten default-src directive
#    - Specify exact sources for each directive
#    - Implement strict object-src and base-uri policies
#
# COMPREHENSIVE SECURITY ANALYSIS FRAMEWORK:
# ==========================================
#
# FRONTEND SECURITY VULNERABILITIES:
# ----------------------------------
# 1. INLINE STYLE VULNERABILITIES:
#    - Move all inline styles to external CSS files
#    - Remove style attributes from HTML elements
#    - Implement CSS nonces for dynamic styling
#
# 2. INLINE JAVASCRIPT VULNERABILITIES:
#    - Move all inline JavaScript to external JS files
#    - Remove onclick, onload, onerror event handlers
#    - Replace with jQuery event handlers or addEventListener
#
# 3. UNSAFE HTML ATTRIBUTES:
#    - Sanitize all user inputs before rendering
#    - Implement proper output encoding
#    - Use safe HTML parsing libraries
#
# 4. XSS VULNERABILITIES:
#    - Implement proper input validation
#    - Use context-aware output encoding
#    - Implement Content Security Policy headers
#
# BACKEND SECURITY VULNERABILITIES:
# ---------------------------------
# 1. INPUT VALIDATION ISSUES:
#    - Add comprehensive input validation for all endpoints
#    - Implement server-side validation
#    - Use whitelist validation approach
#
# 2. SQL INJECTION VULNERABILITIES:
#    - Use parameterized queries for all database operations
#    - Implement prepared statements
#    - Add database access controls
#
# 3. AUTHENTICATION & AUTHORIZATION:
#    - Implement proper session management
#    - Add multi-factor authentication
#    - Implement role-based access control
#
# 4. API SECURITY ISSUES:
#    - Add rate limiting and request validation
#    - Implement API authentication
#    - Add request/response logging

# COMPREHENSIVE REMEDIATION STRATEGY:
# ===================================
#
# Create a unified remediation strategy covering all application layers in a single document:
#
# 1. FRONTEND/UI SECURITY SECTION:
#    - CSP implementation and configuration
#    - Inline styles and JavaScript remediation
#    - Event handling security improvements
#    - Input sanitization and XSS prevention
#
# 2. BACKEND/API SECURITY SECTION:
#    - Input validation implementation
#    - SQL injection vulnerability fixes
#    - Authentication and authorization hardening
#    - Secure session management setup
#
# 3. CONFIGURATION SECURITY SECTION:
#    - Security headers configuration
#    - Environment variable security
#    - HTTPS and SSL/TLS setup
#    - Security middleware implementation
#
# 4. DATABASE SECURITY SECTION:
#    - Parameterized queries implementation
#    - Data validation and sanitization
#    - Audit logging configuration
#    - Database access controls setup
#
# 5. AUTHENTICATION SECURITY SECTION:
#    - Secure session management
#    - Credential handling security
#    - Password policy implementation
#    - Multi-factor authentication setup
#
# FILE STRUCTURE FOR .GITHUB FOLDER:
# ==================================
# Create a single comprehensive remediation file in the .github folder:
# \`\`\`
# .github/
# ├── vulnerability/
# │   ├── application/
# │   │   └── ${vulnerabilityId}_comprehensive_remediation.md
# │   └── README.md
# \`\`\`

# COMPREHENSIVE REMEDIATION CHECKLIST:
# ====================================
#
# CONTENT SECURITY POLICY (CSP) IMPLEMENTATION:
# ---------------------------------------------
# - [ ] Remove all wildcards (*) from CSP directives
# - [ ] Replace 'unsafe-inline' with nonces or hashes
# - [ ] Remove 'unsafe-eval' from script-src directive
# - [ ] Add proper CSP headers to all HTTP responses
# - [ ] Implement strict default-src directive
# - [ ] Configure object-src 'none' directive
# - [ ] Set base-uri to specific trusted sources
# - [ ] Implement frame-ancestors directive
# - [ ] Add Content-Security-Policy-Report-Only header
# - [ ] Configure CSP violation reporting
#
# FRONTEND SECURITY HARDENING:
# ----------------------------
# - [ ] Remove all inline styles and move to external CSS
# - [ ] Remove all inline JavaScript and move to external JS
# - [ ] Replace onclick/onload with jQuery event handlers
# - [ ] Implement proper input sanitization
# - [ ] Add output encoding for all user inputs
# - [ ] Implement safe HTML parsing
# - [ ] Add XSS protection headers
# - [ ] Configure secure cookie settings
#
# BACKEND SECURITY HARDENING:
# ---------------------------
# - [ ] Add input validation for all endpoints
# - [ ] Use parameterized queries for database operations
# - [ ] Implement proper authentication and authorization
# - [ ] Add rate limiting and request validation
# - [ ] Implement secure session management
# - [ ] Add API authentication and authorization
# - [ ] Implement request/response logging
# - [ ] Add security headers middleware
#
# DATABASE SECURITY HARDENING:
# ----------------------------
# - [ ] Use parameterized queries for all database operations
# - [ ] Implement proper data validation
# - [ ] Add database access controls
# - [ ] Implement audit logging
# - [ ] Add database encryption
# - [ ] Implement backup and recovery procedures
# - [ ] Add database monitoring and alerting
#
# CONFIGURATION SECURITY HARDENING:
# ---------------------------------
# - [ ] Remove hardcoded credentials
# - [ ] Use environment variables for sensitive data
# - [ ] Implement proper security headers
# - [ ] Configure HTTPS and SSL/TLS properly
# - [ ] Add security middleware
# - [ ] Implement configuration validation
# - [ ] Add security monitoring

# EXPECTED DELIVERABLES:
# =====================
# Generate a single comprehensive remediation document containing:
# 1. **Complete vulnerability analysis** for all application layers
# 2. **Unified remediation strategy** covering frontend, backend, database, config, and auth
# 3. **Step-by-step implementation guide** with code examples for each layer
# 4. **Before and after code comparisons** showing all fixes
# 5. **Comprehensive testing procedures** to verify all remediations
# 6. **Production deployment guide** with security monitoring setup
# 7. **Complete documentation** for maintenance and audit compliance
#
# CSP IMPLEMENTATION EXAMPLES:
# ============================
# 
# Example 1 - Strict CSP Header:
# ------------------------------
# Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self' 'nonce-{random}'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none';
#
# Example 2 - CSP with Hash:
# --------------------------
# Content-Security-Policy: script-src 'self' 'sha256-{hash}'; style-src 'self' 'sha256-{hash}';
#
# Example 3 - CSP Report-Only:
# ----------------------------
# Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report;
#
# QUALITY ASSURANCE REQUIREMENTS:
# ===============================
# The generated remediation must be:
# - Production-ready and thoroughly tested
# - Security-hardened and compliant with industry standards
# - Well-documented with clear implementation instructions
# - Performance-optimized and scalable
# - Audit-ready with comprehensive documentation
# - Maintainable with clear code structure
#
# FILE SPECIFICATIONS:
# ===================
# - Single File: '${vulnerabilityId}_comprehensive_remediation.md'
# - Location: '.github/vulnerability/application/' folder
# - Format: Single comprehensive markdown document
# - Content: Complete remediation strategy for all application layers
# - Standards: Enterprise security compliance
#
# COMPREHENSIVE DOCUMENT STRUCTURE:
# ================================
# The single document should contain the following sections:
# 1. Executive Summary and Vulnerability Overview
# 2. Repository Analysis and Security Assessment
# 3. Content Security Policy (CSP) Implementation Guide
# 4. Frontend Security Remediation (HTML, CSS, JavaScript)
# 5. Backend Security Remediation (API, Authentication, Validation)
# 6. Database Security Remediation (Queries, Access Controls)
# 7. Configuration Security Remediation (Headers, Environment)
# 8. Authentication Security Remediation (Sessions, Credentials)
# 9. Testing and Validation Procedures
# 10. Production Deployment Guide
# 11. Security Monitoring and Alerting Setup
# 12. Maintenance and Audit Documentation
#
# Please clone the repository, perform comprehensive security analysis, and generate
# a single comprehensive remediation document. Save it to the specified .github folder structure.
# Ensure the document covers all application layers and follows enterprise security standards.`;

    return comprehensivePrompt;
  };

  const filterDropdownOptions = (vulnerability) => {
    if (!vulnerability || !vulnerability.ait_tag) {
      setFilteredSPKOptions([]);
      setFilteredRepoOptions([]);
      return;
    }

    const aitTag = vulnerability.ait_tag;
    
    // Get SPK options for this AIT
    const spkOptions = getSpkData(aitTag);
    setFilteredSPKOptions(spkOptions);
    
    // Reset repository selection when AIT changes
    setSelectedSPK('');
    setSelectedRepository('');
    setFilteredRepoOptions([]);
  };

  const handleSPKChange = (spkValue) => {
    setSelectedSPK(spkValue);
    
    // Get Repository options for this SPK
    const repoOptions = getRepoData(spkValue);
    setFilteredRepoOptions(repoOptions);
    
    // Reset repository selection when SPK changes
    setSelectedRepository('');
  };

  // Function to create the actual folder structure and files
  const createVulnerabilityFolderStructure = async (vulnerability, mainPrompt) => {
    const vulnerabilityId = vulnerability.id || 'unknown';
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Create the folder structure data with only one unified file
    const folderStructure = {
      '.github': {
        'vulnerability': {
          'application': {
            [`${vulnerabilityId}_comprehensive_remediation.md`]: mainPrompt,
            'README.md': `# Vulnerability Remediation

This folder contains comprehensive remediation guides for security vulnerabilities identified in the application.

## Structure
- \`application/\` - Application-level vulnerability remediations
- \`infrastructure/\` - Infrastructure-level vulnerability remediations

## Usage
1. Navigate to the appropriate subfolder
2. Review the comprehensive remediation guide
3. Follow the implementation steps
4. Complete the testing checklist

## Generated: ${timestamp}
## Vulnerability ID: ${vulnerabilityId}`
          }
        }
      }
    };
    
    // Store the folder structure in localStorage for download
    const folderData = {
      structure: folderStructure,
      vulnerabilityId: vulnerabilityId,
      timestamp: timestamp,
      createdAt: new Date().toISOString()
    };
    
    localStorage.setItem(`vulnerability_folder_${vulnerabilityId}`, JSON.stringify(folderData));
    
    console.log('📁 Folder structure created for vulnerability:', vulnerabilityId);
    return folderData;
  };

  // Function to download the folder structure as a ZIP file
  const downloadVulnerabilityFolder = (vulnerabilityId) => {
    const folderData = localStorage.getItem(`vulnerability_folder_${vulnerabilityId}`);
    if (!folderData) {
      alert('No folder structure found for this vulnerability. Please generate the prompt first.');
      return;
    }

    try {
      const data = JSON.parse(folderData);
      const structure = data.structure;
      
      // Create a function to recursively create files in JSZip
      const addFilesToZip = (zip, obj, path = '') => {
        Object.keys(obj).forEach(key => {
          const currentPath = path ? `${path}/${key}` : key;
          
          if (typeof obj[key] === 'string') {
            // It's a file
            zip.file(currentPath, obj[key]);
          } else if (typeof obj[key] === 'object') {
            // It's a folder, recurse
            addFilesToZip(zip, obj[key], currentPath);
          }
        });
      };

      // Create ZIP file
      const zip = new JSZip();
      
      addFilesToZip(zip, structure);
      
      // Generate and download the ZIP file
      zip.generateAsync({ type: 'blob' }).then(content => {
        const url = window.URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `vulnerability_${vulnerabilityId}_remediation.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log('📦 ZIP file downloaded for vulnerability:', vulnerabilityId);
      });
      
    } catch (error) {
      console.error('Error creating ZIP file:', error);
      alert('Error creating ZIP file: ' + error.message);
    }
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
      
      const prompt = generateComprehensiveRemediationPrompt(
        selectedActionVulnerability, 
        selectedSPK, 
        selectedRepository, 
        repoUrl
      );
      
      // Store the generated prompt
      const newPrompts = {
        ...generatedPrompts,
        [`${selectedActionVulnerability.id}_comprehensive`]: prompt
      };
      setGeneratedPrompts(newPrompts);
      localStorage.setItem('generatedPrompts', JSON.stringify(newPrompts));
      
      // Create the actual folder structure and files in the backend
      try {
        const response = await API.post('/api/v1/vulnerabilities/create-application-folder', {
          vulnerability_id: selectedActionVulnerability.id,
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
          alert(`✅ Comprehensive remediation prompt generated successfully! A unified remediation file has been created in .github/vulnerability/application/ folder.\n\nFile created: ${selectedActionVulnerability.id}_comprehensive_remediation.md`);
        } else {
          throw new Error(response.data.error || 'Unknown error');
        }
      } catch (backendError) {
        console.error('Backend folder creation failed, falling back to local storage:', backendError);
        // Fallback to local storage if backend fails
        await createVulnerabilityFolderStructure(selectedActionVulnerability, prompt);
        alert('✅ Comprehensive remediation prompt generated successfully! A unified remediation file has been created locally and can be downloaded.');
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

  // Function to generate infrastructure prompt directly without dropdowns
  const handleGenerateInfrastructurePrompt = async (vulnerability) => {
    try {
      setCreatingActionPrompt(prev => ({ ...prev, [vulnerability.id]: true }));
      console.log('🚀 Generating infrastructure prompt for vulnerability:', vulnerability.id);
      
      // Generate the consolidated Terraform prompt for GitHub Copilot
      const terraformPrompt = generateTerraformPrompt(vulnerability);
      
      // Save the prompt to .github/vulnerability/infrastructure/ folder via backend
      try {
        const response = await API.post('/api/v1/vulnerabilities/create-infrastructure-prompt', {
          vulnerability_id: vulnerability.id,
          vulnerability_title: vulnerability.title || vulnerability.description,
          ait_tag: vulnerability.ait_tag,
          severity: vulnerability.severity,
          remediation_action: vulnerability.remediation_action,
          terraform_prompt: terraformPrompt
        });
        
        if (response.data.success) {
          console.log('✅ Backend infrastructure prompt creation successful:', response.data);
          
          // Store the generated prompt for UI display
          const newPrompts = {
            ...generatedPrompts,
            [`${vulnerability.id}_action`]: terraformPrompt
          };
          setGeneratedPrompts(newPrompts);
          localStorage.setItem('generatedPrompts', JSON.stringify(newPrompts));
          
          alert(`✅ Infrastructure Terraform prompt generated successfully!\n\nPrompt saved to: ${response.data.file_path}\n\nYou can now:\n1. Use "View Action Prompt" to see the GitHub Copilot prompt\n2. Use "Download Prompt" to download the prompt\n3. Use "View Generated TF" to see the generated Terraform file after GitHub Copilot processes it`);
        } else {
          throw new Error(response.data.error || 'Unknown error');
        }
      } catch (backendError) {
        console.error('Backend infrastructure prompt creation failed:', backendError);
        // Fallback to local storage only
        const newPrompts = {
          ...generatedPrompts,
          [`${vulnerability.id}_action`]: terraformPrompt
        };
        setGeneratedPrompts(newPrompts);
        localStorage.setItem('generatedPrompts', JSON.stringify(newPrompts));
        alert('✅ Infrastructure Terraform prompt generated successfully! (Saved locally - backend save failed)');
      }
      
    } catch (error) {
      console.error('Error generating infrastructure prompt:', error);
      alert('Error generating infrastructure prompt: ' + error.message);
    } finally {
      setCreatingActionPrompt(prev => ({ ...prev, [vulnerability.id]: false }));
    }
  };

  const handleActionButton = async (vulnerability) => {
    try {
      setCreatingActionPrompt(prev => ({ ...prev, [vulnerability.id]: true }));
      console.log('🚀 Action button clicked for vulnerability:', vulnerability.id);
      console.log('🔒 Setting loading state for vulnerability:', vulnerability.id);
      console.log('📊 Current loading states:', creatingActionPrompt);
      
      // Call the backend API to create the .github/vulnerability folder and .md file
      const requestData = {
        vulnerability: {
          id: vulnerability.id,
          ait_tag: vulnerability.ait_tag,
          title: vulnerability.title || vulnerability.description,
          severity: vulnerability.severity,
          risk_score: vulnerability.risk_score,
          remediation_action: vulnerability.remediation_action
        }
      };
      
      console.log('📤 Sending request to API:', requestData);
      
      const response = await API.post('/api/github/create-vulnerability-prompt', requestData);
      
      if (response.data.success) {
        const { file_path, filename, directory } = response.data;
        
        // Store the action prompt for this vulnerability
        const actionPrompt = generateActionPrompt(vulnerability);
        const newPrompts = {
          ...generatedPrompts,
          [`${vulnerability.id}_action`]: actionPrompt
        };
        setGeneratedPrompts(newPrompts);
        localStorage.setItem('generatedPrompts', JSON.stringify(newPrompts));
        
        // Refresh the GitHub folder status
        await checkGithubFolderStatus();
        
        // Show success message with file details
        alert(`✅ Action prompt created successfully!\n\n` +
              `📁 File created: ${filename}\n` +
              `📂 Location: ${directory}\n` +
              `🔗 Full path: ${file_path}\n\n` +
              `📋 Next steps:\n` +
              `1. The .md file is now in your .github/vulnerability folder\n` +
              `2. Use it with GitHub Copilot in your IDE\n` +
              `3. Generate the .tf file and save it in remediated_vulnerability folder\n` +
              `4. Use "View Generated TF" button for guidance`);
        
        console.log('✅ Action prompt file created:', response.data);
      } else {
        throw new Error(response.data.error || 'Failed to create action prompt file');
      }
      
    } catch (error) {
      console.error('❌ Error creating action prompt file:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error data:', error.response?.data);
      
      let errorMessage = 'Unknown error occurred';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.status) {
        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
      }
      
      alert(`❌ Error creating action prompt file:\n\n${errorMessage}\n\nCheck the console for more details.`);
    } finally {
      setCreatingActionPrompt(prev => ({ ...prev, [vulnerability.id]: false }));
      console.log('🔓 Resetting loading state for vulnerability:', vulnerability.id);
    }
  };

  const handleViewActionPrompt = (vulnerability) => {
    const prompt = generatedPrompts[`${vulnerability.id}_action`];
    if (prompt) {
      setCurrentVulnerability(vulnerability);
      setTerraformContent(prompt);
      setShowTerraformModal(true);
    } else {
      alert('Please click "Action" first to create the action prompt for this vulnerability.');
    }
  };

  const handleViewGeneratedTF = async (vulnerability) => {
    try {
      const aitTag = vulnerability.ait_tag || 'AIT-Unknown';
      const vulnerabilityId = vulnerability.id || 'unknown';
      const expectedFileName = `${aitTag}_${vulnerabilityId}_remediation.tf`;
      
      console.log('🔍 Looking for Terraform file:', expectedFileName);
      
      // First try the exact filename
      let response;
      try {
        response = await API.get(`/api/github/read-remediated-tf/${expectedFileName}`);
      } catch (error) {
        if (error.response?.status === 404) {
          // If exact file not found, try to find any file with the AIT tag
          console.log('🔍 Exact file not found, searching for files with AIT tag:', aitTag);
          try {
            const listResponse = await API.get('/api/github/list-remediated-tf-files');
            if (listResponse.data.success) {
              const files = listResponse.data.files || [];
              const matchingFile = files.find(file => 
                file.includes(aitTag) && file.endsWith('_remediation.tf')
              );
              
              if (matchingFile) {
                console.log('🔍 Found matching file:', matchingFile);
                response = await API.get(`/api/github/read-remediated-tf/${matchingFile}`);
              } else {
                throw new Error('No matching file found');
              }
            } else {
              throw new Error('Failed to list files');
            }
          } catch (listError) {
            console.error('❌ Error listing files:', listError);
            throw error; // Re-throw original error
          }
        } else {
          throw error;
        }
      }
      
      if (response.data.success) {
        const { content, filename: actualFilename, modified, size } = response.data;
        
        // Show the Terraform file content in the modal
        setTerraformContent(`# Terraform Remediation File: ${actualFilename}
# Last Modified: ${new Date(modified).toLocaleString()}
# Size: ${size} bytes

${content}`);
        setShowTerraformModal(true);
        
        console.log('✅ Terraform file loaded successfully:', actualFilename);
      } else {
        throw new Error(response.data.error || 'Failed to read Terraform file');
      }
    } catch (error) {
      console.error('❌ Error reading Terraform file:', error);
      
      if (error.response?.status === 404) {
        // File not found - show helpful message
        const aitTag = vulnerability.ait_tag || 'AIT-Unknown';
        const vulnerabilityId = vulnerability.id || 'unknown';
        const expectedFileName = `${aitTag}_${vulnerabilityId}_remediation.tf`;
        
        alert(`❌ Terraform file not found!\n\n` +
              `Expected file: ${expectedFileName}\n` +
              `Location: remediated_vulnerability folder\n\n` +
              `To generate this file:\n` +
              `1. Click the "Action" button to create the prompt\n` +
              `2. Use the prompt with GitHub Copilot in your IDE\n` +
              `3. Save the generated .tf file in the remediated_vulnerability folder\n` +
              `4. Then try viewing it again.`);
      } else {
        alert('❌ Error reading Terraform file: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleViewActualFile = async (filename) => {
    try {
      console.log('📖 Reading actual file:', filename);
      const response = await API.get(`/api/github/read-vulnerability-file/${filename}`);
      
      if (response.data.success) {
        const { content, filename: actualFilename, modified, size } = response.data;
        
        // Show the actual file content in the modal
        setTerraformContent(`# File: ${actualFilename}
# Last Modified: ${new Date(modified).toLocaleString()}
# Size: ${size} bytes

${content}`);
        setShowTerraformModal(true);
        
        console.log('✅ File content loaded:', actualFilename);
      } else {
        throw new Error(response.data.error || 'Failed to read file');
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('❌ Error reading file: ' + (error.response?.data?.error || error.message));
    }
  };

  const downloadActionPrompt = (vulnerability) => {
    try {
      const actionPrompt = generateActionPrompt(vulnerability);
      const aitTag = vulnerability.ait_tag || 'AIT-Unknown';
      const vulnerabilityId = vulnerability.id || 'unknown';
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Create the file content
      const fileContent = `# Vulnerability Remediation Action Prompt
# Generated on: ${timestamp}
# Vulnerability ID: ${vulnerabilityId}
# AIT Tag: ${aitTag}

${actionPrompt}

# Instructions for Use:
# 1. Save this file in your .github folder
# 2. Use it with GitHub Copilot in your IDE
# 3. The generated .tf file should be saved in remediated_vulnerability folder
# 4. Expected output file: remediated_vulnerability/${aitTag}_${vulnerabilityId}_remediation.tf
`;
      
      // Create and download the file
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${aitTag}_${vulnerabilityId}_action_prompt.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert(`Action prompt downloaded successfully!\n\n` +
            `File: ${aitTag}_${vulnerabilityId}_action_prompt.md\n\n` +
            `Next steps:\n` +
            `1. Save this file in your .github folder\n` +
            `2. Use it with GitHub Copilot in your IDE\n` +
            `3. Generate the .tf file and save it in remediated_vulnerability folder`);
      
    } catch (error) {
      console.error('Error downloading action prompt:', error);
      alert('Error downloading action prompt: ' + error.message);
    }
  };

  const checkGithubFolderStatus = async () => {
    try {
      console.log('🔍 Checking GitHub folder status...');
      const response = await API.get('/api/github/check-vulnerability-folder');
      
      if (response.data.success) {
        setGithubFolderStatus(response.data);
        console.log('✅ GitHub folder status:', response.data);
      } else {
        throw new Error(response.data.error || 'Failed to check folder status');
      }
    } catch (error) {
      console.error('Error checking GitHub folder status:', error);
      setGithubFolderStatus(null);
    }
  };

  const updatePromptWithHostname = (newHostname) => {
    if (currentVulnerability) {
      const updatedPrompt = generateTerraformPrompt(currentVulnerability, newHostname);
      setTerraformContent(updatedPrompt);
    }
  };

  const handleHostnameChange = (e) => {
    const newHostname = e.target.value;
    setHostname(newHostname);
    updatePromptWithHostname(newHostname);
  };

  const startAgent = async () => {
    try {
      await copilotAPI.startAgent();
      loadAgentStatus();
    } catch (error) {
      console.error('Error starting agent:', error);
    }
  };

  const stopAgent = async () => {
    try {
      await copilotAPI.stopAgent();
      loadAgentStatus();
    } catch (error) {
      console.error('Error stopping agent:', error);
    }
  };

  const processVscodeAgent = async (scanId) => {
    try {
      console.log('🔄 Processing VS Code agent for scan:', scanId);
      setProcessingScan(scanId);
      
      // First test the endpoint
      try {
        await vscodeAgentAPI.testEndpoint();
        console.log('✅ VS Code agent endpoint is working');
      } catch (error) {
        console.error('❌ VS Code agent endpoint test failed:', error);
        alert(`VS Code agent endpoint test failed: ${error.message}`);
        return;
      }
      
      const result = await vscodeAgentAPI.processAgent(scanId);
      console.log('✅ VS Code agent processing result:', result);
      
      // Reload projects to show updated status
      setRefreshTrigger(prev => prev + 1);
      
      // Load prompts for this scan
      await loadVscodePrompts(scanId);
      
    } catch (error) {
      console.error('❌ Error processing VS Code agent:', error);
      alert(`Error processing scan: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessingScan(null);
    }
  };

  const loadVscodePrompts = async (scanId) => {
    try {
      console.log('📋 Loading VS Code prompts for scan:', scanId);
      const prompts = await vscodeAgentAPI.getPrompts(scanId);
      console.log('✅ VS Code prompts loaded:', prompts);
      setVscodePrompts(prev => ({ ...prev, [scanId]: prompts }));
      
      // Set the selected scan ID for the modal
      setSelectedScanId(scanId);
      
      // Show the prompts modal
      setShowVscodeModal(true);
      
    } catch (error) {
      console.error('❌ Error loading VS Code prompts:', error);
      alert(`Error loading prompts: ${error.message || 'Unknown error'}`);
    }
  };

  const showFileSelection = async (scanId) => {
    try {
      console.log('🔍 Getting available files for VS Code agent scan:', scanId);
      
      let availableFiles = [];
      
      // First try to get files from copilot task JSON
      try {
        const taskResponse = await copilotAPI.getTaskDetails(scanId);
        if (taskResponse.data && taskResponse.data.file_paths) {
          // Extract file information from copilot task
          availableFiles = Object.entries(taskResponse.data.file_paths).map(([filePath, fileInfo]) => ({
            file_name: fileInfo.file_name,
            file_path: fileInfo.file_path,
            source_file_path: fileInfo.source_file_path,
            status: 'completed', // Assume completed if in task
            scan_id: scanId
          }));
          console.log('📁 Files found in copilot task:', availableFiles);
        }
      } catch (error) {
        console.log('No copilot task found, trying VS Code prompts...');
      }
      
      // If no files found in copilot task, try VS Code prompts
      if (availableFiles.length === 0) {
        try {
          const promptsData = await vscodeAgentAPI.getPrompts(scanId);
          
          if (promptsData && promptsData.prompts) {
            // Extract file information from prompts
            availableFiles = promptsData.prompts.map(prompt => ({
              file_name: prompt.file_name,
              file_path: prompt.file_path,
              status: prompt.status,
              remediated_file: prompt.remediated_file,
              source_file_path: prompt.source_file_path,
              scan_id: scanId
            }));
            console.log('📁 Files found in VS Code prompts:', availableFiles);
          }
        } catch (error) {
          console.error('No prompts data found for scan:', scanId);
        }
      }
      
      if (availableFiles.length === 0) {
        console.error('No files found for scan:', scanId);
        alert('No files found for this scan');
        return;
      }
      
      console.log('📁 Available files for viewing:', availableFiles);
      setAvailableFiles(availableFiles);
      setSelectedFile(null);
      setFileContents(null);
      setShowFileModal(true);
      setSelectedScanId(scanId); // Set the selected scan ID
    } catch (error) {
      console.error('Error fetching available files:', error);
    }
  };

  const viewFile = async () => {
    if (!selectedFile) return;
    
    try {
      console.log('🔍 Viewing file:', selectedFile);
      console.log('📁 Available files:', availableFiles);
      
      // Get the selected file data
      const fileData = availableFiles[selectedFile];
      if (!fileData) {
        console.error('No file data found for selection:', selectedFile);
        return;
      }
      
      console.log('📄 File data:', fileData);
      
      // Get the diff data for this file
              const diffData = await vscodeAgentAPI.getDiff(fileData.scan_id || selectedScanId, fileData.file_name);
      console.log('📊 Diff data received:', diffData);
      
      setDiffData(diffData);
              setSelectedVscodeFile({ 
          scanId: fileData.scan_id || selectedScanId, 
          fileName: fileData.file_name 
        });
        setShowFileModal(false);
        setShowVscodeModal(true);
    } catch (error) {
      console.error('Error fetching file contents:', error);
    }
  };

  const viewVscodeDiff = async (scanId, fileName) => {
    try {
      const diff = await vscodeAgentAPI.getDiff(scanId, fileName);
      setDiffData(diff);
      setSelectedVscodeFile({ scanId, fileName });
      setShowVscodeModal(true);
    } catch (error) {
      console.error('Error fetching VS Code diff:', error);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="badge badge-success">Completed</span>;
      case 'pending':
        return <span className="badge badge-warning">Pending</span>;
      case 'processing':
        return <span className="badge badge-info">Processing</span>;
      case 'error':
        return <span className="badge badge-danger">Error</span>;
      default:
        return <span className="badge badge-secondary">Unknown</span>;
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp || timestamp === 'unknown') return 'Unknown';
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  const getFixStatistics = (fileContents) => {
    if (!fileContents || !fileContents.remediated_content) return null;
    
    const originalLines = fileContents.original_content.split('\n').length;
    const remediatedLines = fileContents.remediated_content.split('\n').length;
    const addedLines = remediatedLines - originalLines;
    
    return {
      originalLines,
      remediatedLines,
      addedLines,
      percentageChange: ((addedLines / originalLines) * 100).toFixed(1)
    };
  };

  const getDiffStatistics = (diffData) => {
    if (!diffData || !diffData.diff) return null;
    
    const { statistics } = diffData.diff;
    return {
      totalOriginalLines: statistics.total_original_lines,
      totalRemediatedLines: statistics.total_remediated_lines,
      addedCount: statistics.added_count,
      removedCount: statistics.removed_count,
      modifiedCount: statistics.modified_count,
      totalChanges: statistics.added_count + statistics.removed_count + statistics.modified_count
    };
  };

  const highlightRemediatedLines = (content, diffData) => {
    if (!content || !diffData || !diffData.diff) return content;
    
    const lines = content.split('\n');
    const { added_lines, modified_lines } = diffData.diff;
    
    return lines.map((line, index) => {
      const lineNumber = index + 1;
      const isAdded = added_lines.some(added => added.line_number === lineNumber);
      const isModified = modified_lines.some(modified => modified.line_number === lineNumber);
      
      let className = '';
      if (isAdded) className = 'line-added';
      else if (isModified) className = 'line-modified';
      
      return (
        <div key={index} className={`line ${className}`}>
          <span className="line-number">{lineNumber}</span>
          <span className="line-content">{line}</span>
        </div>
      );
    });
  };

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Sorting functions
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedProjects = () => {
    if (!sortField) return projects;

    return [...projects].sort((a, b) => {
      let aValue, bValue;

      if (sortField === 'status') {
        aValue = a.status || '';
        bValue = b.status || '';
      } else if (sortField === 'timestamp') {
        aValue = new Date(a.timestamp || 0);
        bValue = new Date(b.timestamp || 0);
      } else {
        return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <i className="fas fa-sort text-muted"></i>;
    return sortDirection === 'asc' ? 
      <i className="fas fa-sort-up text-primary"></i> : 
      <i className="fas fa-sort-down text-primary"></i>;
  };

  // Load task details for a specific scan
  const loadTaskDetails = async (scanId) => {
    try {
      console.log('📋 Loading task details for scan:', scanId);
      const response = await copilotAPI.getTaskDetails(scanId);
      console.log('✅ Task details loaded:', response);
      setTaskDetails(prev => ({ ...prev, [scanId]: response.data }));
      setShowTaskModal(true);
    } catch (error) {
      console.error('❌ Error loading task details:', error);
      alert(`Error loading task details: ${error.message || 'Unknown error'}`);
    }
  };

  // Load VS Code instructions for a scan
  const loadInstructions = async (scanId) => {
    try {
      console.log('📖 Loading VS Code instructions for scan:', scanId);
      const response = await vscodeCopilotAPI.getInstructions(scanId);
      console.log('✅ Instructions loaded:', response);
      setInstructions(prev => ({ ...prev, [scanId]: response }));
      setShowInstructionsModal(true);
    } catch (error) {
      console.error('❌ Error loading instructions:', error);
      alert(`Error loading instructions: ${error.message || 'Unknown error'}`);
    }
  };

  // Load VS Code workspace for a scan
  const loadWorkspace = async (scanId) => {
    try {
      console.log('🏗️ Loading VS Code workspace for scan:', scanId);
      const response = await vscodeCopilotAPI.getWorkspace(scanId);
      console.log('✅ Workspace loaded:', response);
      setWorkspaceData(prev => ({ ...prev, [scanId]: response }));
      setShowWorkspaceModal(true);
    } catch (error) {
      console.error('❌ Error loading workspace:', error);
      alert(`Error loading workspace: ${error.message || 'Unknown error'}`);
    }
  };

  // Download VS Code files for a scan
  const downloadVscodeFiles = async (scanId) => {
    try {
      console.log('📥 Downloading VS Code files for scan:', scanId);
      setDownloadProgress(prev => ({ ...prev, [scanId]: 'downloading' }));
      
      const result = await vscodeCopilotAPI.downloadFiles(scanId);
      console.log('✅ Download completed:', result);
      
      setDownloadProgress(prev => ({ ...prev, [scanId]: 'completed' }));
      setTimeout(() => {
        setDownloadProgress(prev => ({ ...prev, [scanId]: null }));
      }, 3000);
      
    } catch (error) {
      console.error('❌ Error downloading files:', error);
      setDownloadProgress(prev => ({ ...prev, [scanId]: 'error' }));
      alert(`Error downloading files: ${error.message || 'Unknown error'}`);
      
      setTimeout(() => {
        setDownloadProgress(prev => ({ ...prev, [scanId]: null }));
      }, 3000);
    }
  };

  // Process copilot task for a scan
  const processCopilotTask = async (scanId) => {
    try {
      console.log('🔄 Processing copilot task for scan:', scanId);
      setProcessingScan(scanId);
      
      const result = await copilotAPI.processTask(scanId);
      console.log('✅ Copilot task processing result:', result);
      
      // Reload projects to show updated status
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error('❌ Error processing copilot task:', error);
      alert(`Error processing copilot task: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessingScan(null);
    }
  };

  // Load copilot prompts for a scan
  const loadCopilotPrompts = async (scanId) => {
    try {
      console.log('📋 Loading copilot prompts for scan:', scanId);
      
      // Get task details to extract prompts
      const taskResponse = await copilotAPI.getTaskDetails(scanId);
      console.log('✅ Task details loaded:', taskResponse);
      
      if (taskResponse.data && taskResponse.data.suggested_remediations) {
        const prompts = [];
        
        // Convert suggested remediations to prompts
        Object.entries(taskResponse.data.suggested_remediations).forEach(([filePath, remediations]) => {
          if (remediations && remediations.length > 0) {
            const fileInfo = taskResponse.data.file_paths?.[filePath] || {};
            
            // Create a comprehensive prompt for each file
            let promptText = `# Security Remediation Prompt for ${fileInfo.file_name || filePath}\n\n`;
            promptText += `## File Information\n`;
            promptText += `- File: ${fileInfo.file_name || filePath}\n`;
            promptText += `- Path: ${filePath}\n`;
            promptText += `- Issues Found: ${remediations.length}\n\n`;
            
            promptText += `## Security Issues to Fix\n\n`;
            
            remediations.forEach((remediation, index) => {
              promptText += `### Issue ${index + 1}: ${remediation.severity} - ${remediation.type}\n`;
              promptText += `- **Line**: ${remediation.line_number || 'Unknown'}\n`;
              promptText += `- **Message**: ${remediation.message}\n`;
              promptText += `- **Code Snippet**: \`\`\`\n${remediation.code_snippet}\n\`\`\`\n`;
              promptText += `- **Suggested Fix**: ${remediation.suggested_fix}\n`;
              promptText += `- **Threat Level**: ${remediation.threat_level}\n`;
              promptText += `- **Effort**: ${remediation.effort_minutes} minutes\n\n`;
            });
            
            promptText += `## Instructions\n`;
            promptText += `Please review the code and apply the suggested fixes to address the security vulnerabilities. `;
            promptText += `Focus on removing dangerous operations and implementing secure alternatives.\n\n`;
            promptText += `## Expected Output\n`;
            promptText += `Provide the remediated code with all security issues fixed. `;
            promptText += `Include comments explaining what was changed and why.\n`;
            
            prompts.push({
              file_name: fileInfo.file_name || Path(filePath).name,
              file_path: filePath,
              prompt_text: promptText,
              issues_count: remediations.length,
              severity: remediations.some(r => r.severity === 'CRITICAL_BOMB') ? 'CRITICAL' : 'HIGH'
            });
          }
        });
        
        setCopilotPrompts(prev => ({ ...prev, [scanId]: prompts }));
        setShowCopilotPromptsModal(true);
        
        console.log('✅ Copilot prompts loaded:', prompts);
      } else {
        alert('No remediation suggestions found for this scan');
      }
      
    } catch (error) {
      console.error('❌ Error loading copilot prompts:', error);
      alert(`Error loading copilot prompts: ${error.message || 'Unknown error'}`);
    }
  };

  // Initialize tooltips (fallback approach without Bootstrap JS dependency)
  useEffect(() => {
    // Simple tooltip implementation that works without Bootstrap JS
    const tooltipElements = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    
    const showTooltip = (element) => {
      const title = element.getAttribute('title');
      if (!title) return;
      
      // Remove title to prevent default browser tooltip
      element.setAttribute('data-original-title', title);
      element.removeAttribute('title');
      
      // Create custom tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'custom-tooltip';
      tooltip.textContent = title;
      tooltip.style.cssText = `
        position: absolute;
        background: #2d3748;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 9999;
        max-width: 400px;
        word-wrap: break-word;
        white-space: pre-wrap;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        pointer-events: none;
      `;
      
      document.body.appendChild(tooltip);
      element._customTooltip = tooltip;
      
      // Position tooltip
      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.top - tooltipRect.height - 8;
      
      // Adjust if tooltip goes off screen
      if (left < 8) left = 8;
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }
      if (top < 8) {
        top = rect.bottom + 8;
      }
      
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    };
    
    const hideTooltip = (element) => {
      if (element._customTooltip) {
        document.body.removeChild(element._customTooltip);
        element._customTooltip = null;
      }
      
      // Restore original title
      const originalTitle = element.getAttribute('data-original-title');
      if (originalTitle) {
        element.setAttribute('title', originalTitle);
        element.removeAttribute('data-original-title');
      }
    };
    
    // Add event listeners
    tooltipElements.forEach(element => {
      element.addEventListener('mouseenter', () => showTooltip(element));
      element.addEventListener('mouseleave', () => hideTooltip(element));
      element.addEventListener('focus', () => showTooltip(element));
      element.addEventListener('blur', () => hideTooltip(element));
    });
    
    // Cleanup function
    return () => {
      tooltipElements.forEach(element => {
        hideTooltip(element);
        element.removeEventListener('mouseenter', () => showTooltip(element));
        element.removeEventListener('mouseleave', () => hideTooltip(element));
        element.removeEventListener('focus', () => showTooltip(element));
        element.removeEventListener('blur', () => hideTooltip(element));
      });
    };
  }, [vulnerabilities, infrastructureVulnerabilities]);

  return (
    <div className="copilot-remediation">
      {/* Tab Navigation - Moved to Top */}
      <div className="tab-navigation mb-4">
        <ul className="nav nav-tabs">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
              style={{
                color: activeTab === 'projects' ? '#0d6efd' : '#888',
                background: activeTab === 'projects' ? '#f8f9fa' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'projects' ? '3px solid #0d6efd' : '3px solid transparent',
                padding: '10px 20px',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-list"></i> Issue Remediation 
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'vulnerabilities' ? 'active' : ''}`}
              onClick={() => setActiveTab('vulnerabilities')}
              style={{
                color: activeTab === 'vulnerabilities' ? '#0d6efd' : '#888',
                background: activeTab === 'vulnerabilities' ? '#f8f9fa' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'vulnerabilities' ? '3px solid #0d6efd' : '3px solid transparent',
                padding: '10px 20px',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-shield-alt"></i> Vulnerabilities Remediation
            </button>
          </li>
        </ul>
      </div>

      {/* Dynamic Header Content */}
      {activeTab === 'projects' && (
        <div className="header">
          <div className="header-content">
            {/* <h2><i className="fas fa-list"></i> Issue Remediation</h2>
            <p>Automated security issue remediation using Threat Copilot extension. Process uploaded projects and generate remediation prompts for security issues.</p> */}
          </div>
          
          <div className="info-cards">
            <div className="info-card">
              <div className="info-card-icon">
                <span className="emoji-icon">📁</span>
                <i className="fas fa-folder-open"></i>
              </div>
              <div className="info-card-content">
                <h6>Total Projects</h6>
                <p>{projects.length}</p>
              </div>
            </div>
            <div className="info-card">
              <div className="info-card-icon">
                <span className="emoji-icon">🤖</span>
                <i className="fas fa-robot"></i>
              </div>
              <div className="info-card-content">
                <h6>Agent Status</h6>
                <p>{agentStatus.status || 'Unknown'}</p>
              </div>
            </div>
            <div className="info-card">
              <div className="info-card-icon">
                <span className="emoji-icon">🔗</span>
                <i className="fas fa-code-branch"></i>
              </div>
              <div className="info-card-content">
                <h6>Integration Type</h6>
                <p>Threat Extension</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vulnerabilities' && (
        <div className="header">
          <div className="header-content">
            {/* <h2><i className="fas fa-shield-alt"></i> Vulnerability Remediation</h2> */}
            {/* <p>Automated vulnerability remediation using Threat Copilot. Generate Terraform prompts and remediation strategies for identified security vulnerabilities.</p> */}
          </div>
          
          <div className="info-cards">
            <div className="info-card">
              <div className="info-card-icon">
                <span className="emoji-icon">🛡️</span>
                <i className="fas fa-shield-alt"></i>
              </div>
              <div className="info-card-content">
                <h6>Total Vulnerabilities</h6>
                <p>{activeVulnSubTab === 'application' ? vulnerabilities.length : infrastructureVulnerabilities.length}</p>
              </div>
            </div>
            <div className="info-card">
              <div className="info-card-icon">
                <span className="emoji-icon">🔧</span>
                <i className="fas fa-tools"></i>
              </div>
              <div className="info-card-content">
                <h6>Remediation Type</h6>
                <p>{activeVulnSubTab === 'application' ? 'Code Security' : 'Terraform'}</p>
              </div>
            </div>
            <div className="info-card">
              <div className="info-card-icon">
                <span className="emoji-icon">⚡</span>
                <i className="fas fa-bolt"></i>
              </div>
              <div className="info-card-content">
                <h6>Automation</h6>
                <p>AI-Powered</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Status Panel */}
      <div className="agent-status-panel">
        <div className="agent-status-header">
          <h5><i className="fas fa-robot"></i> Threat Copilot Agent</h5>
          <div className="agent-controls">
            <button 
              className="btn btn-success btn-sm" 
              onClick={startAgent}
              disabled={agentStatus.status === 'running'}
            >
              <i className="fas fa-play"></i> Start Agent
            </button>
            <button 
              className="btn btn-danger btn-sm" 
              onClick={stopAgent}
              disabled={agentStatus.status !== 'running'}
            >
              <i className="fas fa-stop"></i> Stop Agent
            </button>
          </div>
        </div>
        <div className="agent-stats">
          <div className="stat-item">
            <span className="stat-label">Status:</span>
            <span className="stat-value">{agentStatus.status || 'Unknown'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Type:</span>
            <span className="stat-value">Extension</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Last Check:</span>
            <span className="stat-value">{agentStatus.timestamp || 'Never'}</span>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      {activeTab === 'projects' && (
        <div className="projects-section">
          <div className="section-header">
            <h5><i className="fas fa-list"></i> Issue Remediation </h5>
            <div className="section-actions">
              <button className="btn btn-outline-primary btn-sm" onClick={refreshData}>
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
            </div>
          </div>
        
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="no-projects">
            <div className="no-projects-icon">
              <i className="fas fa-folder-open"></i>
            </div>
            <h4>No Projects Found</h4>
            <p>Upload files to get started with Threat Copilot remediation.</p>
            <button className="btn btn-primary" onClick={refreshData}>
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
        ) : (
          <div className="projects-table">
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Folders/Files</th>
                    <th>Issues</th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleSort('status')}
                      style={{ cursor: 'pointer' }}
                    >
                      Status {getSortIcon('status')}
                    </th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleSort('timestamp')}
                      style={{ cursor: 'pointer' }}
                    >
                      Timestamp {getSortIcon('timestamp')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedProjects().map((project) => (
                    <tr key={project.scan_id}>
                      <td>
                        <div className="project-info">
                          <div className="project-name">{project.project_name}</div>
                          <div className="project-id">ID: {project.scan_id}</div>
                        </div>
                      </td>
                      <td>
                        <div className="file-count">
                          <span className="file-count-number">{project.file_count}</span>
                          <span className="file-count-label">Folders/Files</span>
                        </div>
                      </td>
                      <td>
                        <div className="issues-info">
                          <div className="total-issues">
                            <span className="issues-number">{project.total_issues}</span>
                            <span className="issues-label">total</span>
                          </div>
                          {project.critical_issues > 0 && (
                            <div className="critical-issues">
                              <span className="critical-number">{project.critical_issues}</span>
                              <span className="critical-label">critical</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{getStatusBadge(project.status)}</td>
                      <td>
                        <div className="timestamp">
                          {formatTimestamp(project.timestamp)}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons d-flex flex-column gap-1">
                          {/* Process Threat Agent Button */}
                          {project.status !== 'completed' && (
                            <button 
                              className="btn btn-primary btn-sm w-100 mb-1"
                              onClick={() => {
                                console.log('🔄 Process VS Code Agent button clicked for scan:', project.scan_id);
                                processVscodeAgent(project.scan_id);
                              }}
                              disabled={processingScan === project.scan_id}
                              title="Process with VS Code Agent"
                            >
                              {processingScan === project.scan_id ? (
                                <>
                                  <i className="fas fa-spinner fa-spin"></i> Processing...
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-play"></i> Threat Agent
                                </>
                              )}
                            </button>
                          )}
                          
                          {/* View Copilot Prompts Button */}
                          <button 
                            className="btn btn-outline-secondary btn-sm w-100 mb-1"
                            onClick={() => {
                              console.log('📋 View Copilot Prompts button clicked for scan:', project.scan_id);
                              loadCopilotPrompts(project.scan_id);
                            }}
                            title="View Copilot Prompts"
                          >
                            <i className="fas fa-file-code"></i> View Prompts
                          </button>
                          
                          {/* Task Details Button */}
                          <button 
                            className="btn btn-outline-info btn-sm w-100 mb-1"
                            onClick={() => {
                              console.log('📋 Task Details button clicked for scan:', project.scan_id);
                              loadTaskDetails(project.scan_id);
                            }}
                            title="View Task Details"
                          >
                            <i className="fas fa-info-circle"></i> Details
                          </button>
                          
                          {/* Download Threat Files Button */}
                          <button 
                            className="btn btn-outline-warning btn-sm w-100 mb-1"
                            onClick={() => {
                              console.log('📥 Download button clicked for scan:', project.scan_id);
                              downloadVscodeFiles(project.scan_id);
                            }}
                            disabled={downloadProgress[project.scan_id]}
                            title="Download Threat Files"
                          >
                            {downloadProgress[project.scan_id] === 'downloading' ? (
                              <>
                                <i className="fas fa-spinner fa-spin"></i> Downloading...
                              </>
                            ) : downloadProgress[project.scan_id] === 'completed' ? (
                              <>
                                <i className="fas fa-check"></i> Downloaded
                              </>
                            ) : downloadProgress[project.scan_id] === 'error' ? (
                              <>
                                <i className="fas fa-exclamation-triangle"></i> Error
                              </>
                            ) : (
                              <>
                                <i className="fas fa-download"></i> Download
                              </>
                            )}
                          </button>
                          
                          {/* Prompts Button - Show for projects with VS Code prompts */}
                          {project.has_vscode_prompts && (
                            <button 
                              className="btn btn-info btn-sm w-100"
                              onClick={() => {
                                console.log('📋 Prompts button clicked for scan:', project.scan_id);
                                loadVscodePrompts(project.scan_id);
                              }}
                              title="View Threat Prompts"
                            >
                               <i className="fas fa-eye"></i> View Remediated
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Vulnerabilities Table */}
      {activeTab === 'vulnerabilities' && (
        <div className="vulnerabilities-section">
          <div className="section-header">
            <h5><i className="fas fa-shield-alt"></i> Vulnerability Remediation</h5>
            <div className="section-actions">
              {/* Excel Data Indicator */}
              {localStorage.getItem('excel_vulnerabilities') && (() => {
                try {
                  const excelData = JSON.parse(localStorage.getItem('excel_vulnerabilities'));
                  return (
                    <span className="badge bg-info me-2" title={`${excelData.length} Excel records loaded and merged`}>
                      📁 {excelData.length} Excel Records
                    </span>
                  );
                } catch (error) {
                  return (
                    <span className="badge bg-info me-2" title="Excel data is loaded and merged">
                      📁 Excel Data Loaded
                    </span>
                  );
                }
              })()}
              <button className="btn btn-outline-primary btn-sm" onClick={loadVulnerabilities}>
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
              <button 
                className="btn btn-outline-danger btn-sm ms-2" 
                onClick={clearAllVulnerabilities}
                title={`Clear all ${activeVulnSubTab} vulnerability records`}
              >
                <i className="fas fa-trash"></i> Clear All
              </button>
              {activeVulnSubTab === 'infrastructure' && (
                <button 
                  className="btn btn-outline-info btn-sm ms-2" 
                  onClick={loadSampleInfrastructureData}
                  title="Load sample infrastructure vulnerability data"
                >
                  <i className="fas fa-file-alt"></i> Load Sample Data
                </button>
              )}
              {activeVulnSubTab === 'application' && (
                <>
                  <button 
                    className="btn btn-outline-warning btn-sm ms-2" 
                    onClick={cleanupApplicationFiles}
                    title="Clean up old multiple application vulnerability files"
                  >
                    <i className="fas fa-broom"></i> Cleanup Old Files
                  </button>
                  <button 
                    className="btn btn-outline-info btn-sm ms-2" 
                    onClick={cleanupOldExcelData}
                    title="Clean up old Excel data with excel- prefix"
                  >
                    <i className="fas fa-file-excel"></i> Fix Excel IDs
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Sub-tab Navigation for Vulnerability Remediation */}
          <div className="card-body border-bottom">
            <ul className="nav nav-pills" role="tablist">
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeVulnSubTab === 'application' ? 'active' : ''}`}
                  onClick={() => setActiveVulnSubTab('application')}
                  type="button"
                  role="tab"
                >
                  <i className="fas fa-bug me-2"></i>
                  🐛 Application Vulnerabilities ({vulnerabilities.length})
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeVulnSubTab === 'infrastructure' ? 'active' : ''}`}
                  onClick={() => setActiveVulnSubTab('infrastructure')}
                  type="button"
                  role="tab"
                >
                  <i className="fas fa-server me-2"></i>
                  🖥️ Infrastructure Vulnerabilities ({infrastructureVulnerabilities.length})
                </button>
              </li>
            </ul>
          </div>
          
          {/* Filter Controls */}
          <div className="card-body border-bottom filter-controls">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">
                  <i className="fas fa-search me-1"></i>
                  Search {activeVulnSubTab === 'application' ? 'Application' : 'Infrastructure'} Vulnerabilities
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by GIS ID, title, description, or remediation action..."
                  value={activeVulnSubTab === 'application' ? vulnSearchFilter : infraSearchFilter}
                  onChange={(e) => {
                    if (activeVulnSubTab === 'application') {
                      setVulnSearchFilter(e.target.value);
                    } else {
                      setInfraSearchFilter(e.target.value);
                    }
                  }}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">
                  <i className="fas fa-exclamation-triangle me-1"></i>
                  Filter by Severity
                </label>
                <select
                  className="form-select"
                  value={activeVulnSubTab === 'application' ? vulnSeverityFilter : infraSeverityFilter}
                  onChange={(e) => {
                    if (activeVulnSubTab === 'application') {
                      setVulnSeverityFilter(e.target.value);
                    } else {
                      setInfraSeverityFilter(e.target.value);
                    }
                  }}
                >
                  <option value="">All Severities</option>
                  {getUniqueSeverities(activeVulnSubTab === 'application' ? vulnerabilities : infrastructureVulnerabilities).map(severity => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">
                  <i className="fas fa-tag me-1"></i>
                  Filter by AIT Tag
                </label>
                <select
                  className="form-select"
                  value={activeVulnSubTab === 'application' ? vulnAitFilter : infraAitFilter}
                  onChange={(e) => {
                    if (activeVulnSubTab === 'application') {
                      setVulnAitFilter(e.target.value);
                    } else {
                      setInfraAitFilter(e.target.value);
                    }
                  }}
                >
                  <option value="">All AIT Tags</option>
                  {getUniqueAitTags(activeVulnSubTab === 'application' ? vulnerabilities : infrastructureVulnerabilities).map(ait => (
                    <option key={ait} value={ait}>
                      {ait}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">&nbsp;</label>
                <div className="d-grid">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={activeVulnSubTab === 'application' ? clearVulnFilters : clearInfraFilters}
                    title="Clear all filters"
                  >
                    <i className="fas fa-times"></i> Clear Filters
                  </button>
                </div>
              </div>
            </div>
            <div className="row mt-2">
              <div className="col-12">
                <div className="filter-status">
                  <small className="text-muted">
                  <i className="fas fa-info-circle me-1"></i>
                  Showing {(() => {
                    const currentVulns = activeVulnSubTab === 'application' ? vulnerabilities : infrastructureVulnerabilities;
                    const filteredVulns = filterVulnerabilities(
                      currentVulns,
                      activeVulnSubTab === 'application' ? vulnSearchFilter : infraSearchFilter,
                      activeVulnSubTab === 'application' ? vulnSeverityFilter : infraSeverityFilter,
                      activeVulnSubTab === 'application' ? vulnAitFilter : infraAitFilter
                    );
                    return `${filteredVulns.length} of ${currentVulns.length} ${activeVulnSubTab} vulnerabilities`;
                  })()}
                  </small>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Button Information */}
          {/* <div className="alert alert-info mb-3">
            <div className="d-flex align-items-start">
              <i className="fas fa-info-circle me-2 mt-1"></i>
              <div>
                <strong>🚀 New Action Button:</strong> Use the <strong>Action</strong> button to automatically create a prompt file in the <code>.github/vulnerability</code> folder for use with GitHub Copilot. The system will create the folder structure and generate the markdown file directly.
                <br />
                <small className="text-muted">
                  • <strong>Action:</strong> Generates prompt for .github folder<br/>
                  • <strong>View Action Prompt:</strong> Shows the generated prompt<br/>
                  • <strong>Download Prompt:</strong> Downloads prompt as .md file for .github folder<br/>
                  • <strong>View Generated TF:</strong> View the actual Terraform file from the remediated_vulnerability folder<br/>
                  • <strong>Run:</strong> Original Terraform prompt generation<br/>
                  • <strong>View Prompt:</strong> Shows the original prompt
                </small>
              </div>
            </div>
          </div> */}
          
          {/* Show Terraform-related status only for Infrastructure vulnerabilities */}
          {activeVulnSubTab === 'infrastructure' && (
            <>
          {/* GitHub Folder Status */}
          {githubFolderStatus ? (
            <div className={`alert ${githubFolderStatus.exists ? 'alert-success' : 'alert-warning'} mb-3`}>
              <div className="d-flex align-items-start">
                <i className={`fas ${githubFolderStatus.exists ? 'fa-check-circle' : 'fa-exclamation-triangle'} me-2 mt-1`}></i>
                <div>
                  <strong>📁 GitHub Folder Status:</strong> {githubFolderStatus.message}
                  {githubFolderStatus.exists && (
                    <>
                      <br />
                      <small className="text-muted">
                        {/* 📂 Directory: <code>{githubFolderStatus.directory}</code><br/> */}
                        📄 Files: {githubFolderStatus.file_count} prompt file(s)<br/>
                        {githubFolderStatus.files.length > 0 && (
                          <>
                            📋 Recent files:<br/>
                            {githubFolderStatus.files.slice(0, 3).map((file, index) => (
                              <button
                                key={index}
                                className="badge bg-light text-dark me-1 border-0"
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleViewActualFile(file.filename)}
                                title={`Click to view ${file.filename}`}
                              >
                                {file.filename}
                              </button>
                            ))}
                            {githubFolderStatus.files.length > 3 && (
                              <span className="text-muted">... and {githubFolderStatus.files.length - 3} more</span>
                            )}
                          </>
                        )}
                      </small>
                      <div className="mt-2">
                        <button 
                          className="btn btn-outline-secondary btn-sm"
                          onClick={checkGithubFolderStatus}
                          title="Refresh folder status"
                        >
                          <i className="fas fa-sync-alt"></i> Refresh Status
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="alert alert-info mb-3">
              <div className="d-flex align-items-start">
                <i className="fas fa-info-circle me-2 mt-1"></i>
                <div>
                  <strong>📁 GitHub Folder Status:</strong> Click the button below to check the current status of your .github/vulnerability folder.
                  <div className="mt-2">
                    <button 
                      className="btn btn-outline-info btn-sm me-2"
                      onClick={checkGithubFolderStatus}
                      title="Check folder status"
                    >
                      <i className="fas fa-folder-open"></i> Check Folder Status
                    </button>
                    <button 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={async () => {
                        try {
                          const response = await API.get('/api/github/test');
                          if (response.data.success) {
                            alert(`✅ API Test Successful!\n\nCurrent Directory: ${response.data.current_directory}\nTimestamp: ${response.data.timestamp}`);
                          } else {
                            alert('❌ API Test Failed: ' + response.data.error);
                          }
                        } catch (error) {
                          alert('❌ API Test Failed: ' + error.message);
                        }
                      }}
                      title="Test GitHub API connection"
                    >
                      <i className="fas fa-vial"></i> Test API
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Remediated Terraform Files Status */}
          <div className="alert alert-success mb-3">
            <div className="d-flex align-items-start">
              <i className="fas fa-file-code me-2 mt-1"></i>
              <div>
                <strong>🔧 Terraform Remediation Files:</strong>
                <div className="mt-2">
                  <button 
                    className="btn btn-outline-success btn-sm me-2"
                    onClick={async () => {
                      try {
                        const response = await API.get('/api/github/check-remediated-folder');
                        if (response.data.success) {
                          setRemediatedFolderStatus(response.data);
                          console.log('✅ Remediated folder status:', response.data);
                        } else {
                          throw new Error(response.data.error || 'Failed to check remediated folder status');
                        }
                      } catch (error) {
                        console.error('Error checking remediated folder status:', error);
                        alert('❌ Error checking remediated folder: ' + (error.response?.data?.error || error.message));
                      }
                    }}
                    title="Check for available Terraform files"
                  >
                    <i className="fas fa-search"></i> Check Terraform Files
                  </button>
                  {/* <button 
                    className="btn btn-outline-info btn-sm"
                    onClick={() => {
                      if (remediatedFolderStatus && remediatedFolderStatus.exists) {
                        alert(`📁 Remediated Folder: ${remediatedFolderStatus.directory}\n📄 Found ${remediatedFolderStatus.file_count} Terraform file(s)\n\nClick on any file name below to view its contents.`);
                      } else {
                        alert('ℹ️ Click "Check Terraform Files" first to see available files.');
                      }
                    }}
                    title="Show folder information"
                  >
                    <i className="fas fa-info-circle"></i> Folder Info
                  </button> */}
                </div>
                {remediatedFolderStatus && remediatedFolderStatus.exists && (
                  <div className="mt-2">
                    <small className="text-muted">
                      {/* 📂 Directory: <code>{remediatedFolderStatus.directory}</code><br/> */}
                      📄 Files: {remediatedFolderStatus.file_count} Terraform file(s)<br/>
                      {remediatedFolderStatus.files.length > 0 && (
                        <>
                          📋 Available files:<br/>
                          {remediatedFolderStatus.files.map((file, index) => (
                            <button
                              key={index}
                              className="badge bg-success text-white me-1 mb-1 border-0"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setTerraformContent(`# Terraform File: ${file.filename}
# Last Modified: ${new Date(file.modified).toLocaleString()}
# Size: ${file.size} bytes

[File content will be loaded when you click "View Generated TF" on a vulnerability]`);
                                setShowTerraformModal(true);
                                alert(`📄 File: ${file.filename}\n📁 Location: ${remediatedFolderStatus.directory}\n📅 Modified: ${new Date(file.modified).toLocaleString()}\n📏 Size: ${file.size} bytes\n\nTo view the actual content, use the "View Generated TF" button on a vulnerability row.`);
                              }}
                              title={`Click to see file info: ${file.filename}\nSize: ${file.size} bytes\nModified: ${new Date(file.modified).toLocaleString()}`}
                            >
                              {file.filename}
                            </button>
                          ))}
                        </>
                      )}
                    </small>
                  </div>
                )}
              </div>
            </div>
          </div>
            </>
          )}
          
          {vulnerabilitiesLoading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading vulnerabilities...</p>
            </div>
          ) : (() => {
            const allVulns = activeVulnSubTab === 'application' ? vulnerabilities : infrastructureVulnerabilities;
            const currentVulns = filterVulnerabilities(
              allVulns,
              activeVulnSubTab === 'application' ? vulnSearchFilter : infraSearchFilter,
              activeVulnSubTab === 'application' ? vulnSeverityFilter : infraSeverityFilter,
              activeVulnSubTab === 'application' ? vulnAitFilter : infraAitFilter
            );
            return currentVulns.length === 0 ? (
            <div className="no-projects">
              <div className="no-projects-icon">
                <i className="fas fa-shield-alt"></i>
              </div>
                <h4>
                  {allVulns.length === 0 ? 
                    `No ${activeVulnSubTab === 'application' ? 'Application' : 'Infrastructure'} Vulnerabilities Found` :
                    `No ${activeVulnSubTab === 'application' ? 'Application' : 'Infrastructure'} Vulnerabilities Match Filters`
                  }
                </h4>
                <p>
                  {allVulns.length === 0 ? 
                    `No ${activeVulnSubTab === 'application' ? 'application' : 'infrastructure'} vulnerabilities are currently available for remediation.` :
                    `No vulnerabilities match the current filter criteria. Try adjusting your search terms or clearing the filters.`
                  }
                </p>
                <div className="d-flex gap-2 justify-content-center">
              <button className="btn btn-primary" onClick={loadVulnerabilities}>
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
                  {allVulns.length > 0 && (
                    <button 
                      className="btn btn-outline-secondary" 
                      onClick={activeVulnSubTab === 'application' ? clearVulnFilters : clearInfraFilters}
                    >
                      <i className="fas fa-times"></i> Clear Filters
                    </button>
                  )}
                </div>
            </div>
          ) : (
            <div className="projects-table vulnerability-table">
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>GIS ID</th>
                      <th>AIT</th>
                      <th>Vulnerability</th>
                      <th>Severity</th>
                      <th>Remediation Action</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentVulns.map((vulnerability) => (
                      <tr key={vulnerability.id}>
                        <td>
                          <div className="project-info">
                            <div className="project-id" title={`Internal ID: ${vulnerability.id}`}>
                              {vulnerability.gis_id || 'N/A'}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-info">
                            {vulnerability.ait_tag || 'AIT-Unknown'}
                          </span>
                        </td>
                        <td>
                          <div className="project-info">
                            <div className="project-name">{vulnerability.title || vulnerability.description}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${
                            vulnerability.severity === 'CRITICAL_BOMB' ? 'bg-danger' :
                            vulnerability.severity === 'HIGH_RISK' ? 'bg-warning' :
                            vulnerability.severity === 'MEDIUM_RISK' ? 'bg-info' :
                            vulnerability.severity === 'LOW_RISK' ? 'bg-success' : 'bg-secondary'
                          }`}>
                            {vulnerability.severity === 'CRITICAL_BOMB' ? 'Critical' :
                             vulnerability.severity === 'HIGH_RISK' ? 'High' :
                             vulnerability.severity === 'MEDIUM_RISK' ? 'Medium' :
                             vulnerability.severity === 'LOW_RISK' ? 'Low' : 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <div className="project-info">
                            <div 
                              className="project-name text-truncate" 
                              style={{ 
                                maxWidth: '300px',
                                cursor: 'pointer'
                              }}
                              title={vulnerability.remediation_action || 'Update to latest version'}
                              data-bs-toggle="tooltip" 
                              data-bs-placement="top"
                            >
                              {vulnerability.remediation_action || 'Update to latest version'}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="action-buttons d-flex flex-column gap-1">
                            {activeVulnSubTab === 'application' ? (
                              // Application vulnerabilities - Action and Download buttons
                              <>
                            <button 
                              className="btn btn-primary btn-sm w-100 mb-1"
                              onClick={() => {
                                    console.log('🚀 Open action popup for vulnerability:', vulnerability.id);
                                    setSelectedActionVulnerability(vulnerability);
                                    filterDropdownOptions(vulnerability);
                                    setShowActionPopup(true);
                                  }}
                                  title={`Open Action Popup for vulnerability ${vulnerability.id}`}
                                >
                                  <i className="fas fa-rocket"></i> Action
                            </button>
                            
                                {/* Download Folder Button */}
                                <button 
                                  className="btn btn-outline-success btn-sm w-100"
                              onClick={() => {
                                    console.log('📦 Download folder for vulnerability:', vulnerability.id);
                                    downloadVulnerabilityFolder(vulnerability.id);
                                  }}
                                  title={`Download .github/vulnerability/application/ folder for ${vulnerability.id}`}
                                >
                                  <i className="fas fa-download"></i> Download Folder
                                </button>
                              </>
                            ) : (
                              // Infrastructure vulnerabilities - Terraform functionality + Direct Action
                              <>
                                {/* Action Button - Generate Infrastructure Prompt */}
                                <button 
                                  className="btn btn-primary btn-sm w-100 mb-1"
                                  onClick={() => {
                                    console.log('🚀 Generate infrastructure prompt for vulnerability:', vulnerability.id);
                                    handleGenerateInfrastructurePrompt(vulnerability);
                                  }}
                                  title={`Generate Infrastructure Prompt for vulnerability ${vulnerability.id}`}
                                >
                                  {creatingActionPrompt[vulnerability.id] ? (
                                    <>
                                      <i className="fas fa-spinner fa-spin"></i> Creating...
                                </>
                              ) : (
                                <>
                                      <i className="fas fa-rocket"></i> Action
                                </>
                              )}
                                </button>
                            
                            {/* View Action Prompt Button */}
                            <button 
                              className="btn btn-outline-primary btn-sm w-100 mb-1"
                              onClick={() => {
                                console.log('📋 View action prompt for vulnerability:', vulnerability.id);
                                handleViewActionPrompt(vulnerability);
                              }}
                              disabled={!generatedPrompts[`${vulnerability.id}_action`]}
                              title={!generatedPrompts[`${vulnerability.id}_action`] ? 'Click "Action" first to create action prompt' : 'View action prompt for .github folder'}
                            >
                              <i className="fas fa-file-alt"></i> View Action Prompt
                            </button>
                            
                            {/* Download Action Prompt Button */}
                            <button 
                              className="btn btn-outline-info btn-sm w-100 mb-1"
                              onClick={() => {
                                console.log('📥 Download action prompt for vulnerability:', vulnerability.id);
                                downloadActionPrompt(vulnerability);
                              }}
                              disabled={!generatedPrompts[`${vulnerability.id}_action`]}
                              title={!generatedPrompts[`${vulnerability.id}_action`] ? 'Click "Action" first to create action prompt' : 'Download action prompt as .md file'}
                            >
                              <i className="fas fa-download"></i> Download Prompt
                            </button>
                            
                            {/* View Generated TF Button */}
                            <button 
                              className="btn btn-outline-success btn-sm w-100"
                              onClick={() => {
                                console.log('📁 View generated TF file for vulnerability:', vulnerability.id);
                                handleViewGeneratedTF(vulnerability);
                              }}
                              title="View generated Terraform file from remediated_vulnerability folder"
                            >
                              <i className="fas fa-folder-open"></i> View Generated TF
                            </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* File Selection Modal */}
      {showFileModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-file"></i> Select File to View
                </h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => setShowFileModal(false)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="file-selection">
                  <label>Choose a file to view:</label>
                  <select 
                    className="form-control"
                    onChange={(e) => setSelectedFile(availableFiles[e.target.value])}
                  >
                    <option value="">Select a file...</option>
                    {availableFiles.map((file, index) => (
                      <option key={index} value={index}>
                        {file.file_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowFileModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={viewFile}
                  disabled={!selectedFile}
                >
                  <i className="fas fa-eye"></i> View File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Contents Modal */}
      {fileContents && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-file-code"></i> File Comparison
                </h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => setFileContents(null)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="file-comparison">
                  <div className="file-section">
                    <h6><i className="fas fa-file"></i> Original File</h6>
                    <div className="file-content original">
                      <pre>{fileContents.original_content}</pre>
                    </div>
                  </div>
                  <div className="file-section">
                    <h6><i className="fas fa-file-code"></i> Remediated File</h6>
                    <div className="file-content remediated">
                      <pre>{fileContents.remediated_content}</pre>
                    </div>
                  </div>
                </div>
                
                {getFixStatistics(fileContents) && (
                  <div className="fix-statistics">
                    <h6><i className="fas fa-chart-bar"></i> Fix Statistics</h6>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Original Lines:</span>
                        <span className="stat-value">{getFixStatistics(fileContents).originalLines}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Remediated Lines:</span>
                        <span className="stat-value">{getFixStatistics(fileContents).remediatedLines}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Added Lines:</span>
                        <span className="stat-value">{getFixStatistics(fileContents).addedLines}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Change %:</span>
                        <span className="stat-value">{getFixStatistics(fileContents).percentageChange}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setFileContents(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VS Code Prompts Modal */}
      {showVscodeModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-file-code"></i> Threat Copilot Prompts
                </h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => {
                    setShowVscodeModal(false);
                    setSelectedScanId(null);
                  }}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                {selectedScanId && vscodePrompts[selectedScanId] && (
                  <div className="prompts-section">
                    <h6><i className="fas fa-folder"></i> Scan ID: {selectedScanId}</h6>
                    <div className="prompts-list">
                      {vscodePrompts[selectedScanId].prompts && vscodePrompts[selectedScanId].prompts.map((prompt, index) => (
                        <div key={index} className="prompt-item">
                          <div className="prompt-header">
                            <strong><i className="fas fa-file"></i> {prompt.file_name}</strong>
                            <span className={`badge badge-${prompt.status === 'completed' ? 'success' : 'warning'}`}>
                              {prompt.status}
                            </span>
                          </div>
                          <div className="prompt-content">
                            <p><strong>Security Issues Found:</strong> {prompt.security_issues.length}</p>
                            {prompt.security_issues.map((issue, idx) => (
                              <div key={idx} className="security-issue">
                                <span className="issue-severity">{issue.severity}</span>
                                <span className="issue-description">{issue.description}</span>
                                <span className="issue-line">Line {issue.line}</span>
                              </div>
                            ))}
                            <div className="prompt-actions">
                              <button 
                                className="btn btn-info btn-sm"
                                onClick={() => viewVscodeDiff(selectedScanId, prompt.file_name)}
                              >
                                <i className="fas fa-eye"></i> View Diff
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!selectedScanId || !vscodePrompts[selectedScanId]) && (
                  <div className="no-prompts">
                    <p>No prompts found for this scan.</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowVscodeModal(false);
                    setSelectedScanId(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VS Code Diff Modal */}
      {diffData && (
        <div className="copilotModel modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-code-branch"></i> Threat Diff: {selectedVscodeFile?.fileName}
                </h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => setDiffData(null)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="github-diff-container">
                  <div className="diff-header">
                    <div className="diff-file-info">
                      <span className="file-name">{selectedVscodeFile?.fileName}</span>
                      <span className="diff-stats">
                        {getDiffStatistics(diffData) && (
                          <>
                            <span className="stat-added">+{getDiffStatistics(diffData).addedCount}</span>
                            <span className="stat-removed">-{getDiffStatistics(diffData).removedCount}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  
                  <div className="diff-content">
                    <div className="diff-pane original-pane">
                      <div className="pane-header">
                        <span className="pane-title">Original</span>
                      </div>
                      <div className="pane-content">
                        <div className="line-numbers">
                          {diffData.original_content.split('\n').map((line, index) => (
                            <div key={index} className="line-number">{index + 1}</div>
                          ))}
                        </div>
                        <div className="code-content">
                          {diffData.original_content.split('\n').map((line, index) => {
                            const lineNumber = index + 1;
                            const isRemoved = diffData.diff?.removed_lines?.some(removed => removed.line_number === lineNumber);
                            const isModified = diffData.diff?.modified_lines?.some(modified => modified.line_number === lineNumber);
                            
                            let className = 'line';
                            if (isRemoved) className += ' line-removed';
                            else if (isModified) className += ' line-modified';
                            
                            return (
                              <div key={index} className={className}>
                                <span className="line-text">{line || ' '}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="diff-pane modified-pane">
                      <div className="pane-header">
                        <span className="pane-title">Modified</span>
                      </div>
                      <div className="pane-content">
                        <div className="line-numbers">
                          {diffData.remediated_content.split('\n').map((line, index) => (
                            <div key={index} className="line-number">{index + 1}</div>
                          ))}
                        </div>
                        <div className="code-content">
                          {diffData.remediated_content.split('\n').map((line, index) => {
                            const lineNumber = index + 1;
                            const isAdded = diffData.diff?.added_lines?.some(added => added.line_number === lineNumber);
                            const isModified = diffData.diff?.modified_lines?.some(modified => modified.line_number === lineNumber);
                            
                            let className = 'line';
                            if (isAdded) className += ' line-added';
                            else if (isModified) className += ' line-modified';
                            
                            return (
                              <div key={index} className={className}>
                                <span className="line-text">{line || ' '}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {getDiffStatistics(diffData) && (
                  <div className="diff-statistics">
                    <h6><i className="fas fa-chart-bar"></i> Diff Statistics</h6>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Total Changes:</span>
                        <span className="stat-value">{getDiffStatistics(diffData).totalChanges}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Added Lines:</span>
                        <span className="stat-value">{getDiffStatistics(diffData).addedCount}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Removed Lines:</span>
                        <span className="stat-value">{getDiffStatistics(diffData).removedCount}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Modified Lines:</span>
                        <span className="stat-value">{getDiffStatistics(diffData).modifiedCount}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setDiffData(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {showTaskModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-info-circle"></i> Copilot Task Details
                </h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => setShowTaskModal(false)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                {Object.entries(taskDetails).map(([scanId, taskData]) => (
                  <div key={scanId} className="task-details">
                    <h6><i className="fas fa-folder"></i> Scan ID: {scanId}</h6>
                    <div className="task-summary">
                      <div className="summary-item">
                        <strong>Status:</strong> {taskData.status || 'Unknown'}
                      </div>
                      <div className="summary-item">
                        <strong>Project ID:</strong> {taskData.project_id || 'N/A'}
                      </div>
                      <div className="summary-item">
                        <strong>Timestamp:</strong> {formatTimestamp(taskData.timestamp)}
                      </div>
                      <div className="summary-item">
                        <strong>Total Issues:</strong> {taskData.issues_summary?.total_issues || 0}
                      </div>
                      <div className="summary-item">
                        <strong>Critical Issues:</strong> {taskData.issues_summary?.critical_issues || 0}
                      </div>
                    </div>
                    
                    {taskData.threat_intelligence && (
                      <div className="threat-intelligence">
                        <h6><i className="fas fa-shield-alt"></i> Threat Intelligence</h6>
                        <div className="threat-summary">
                          <div className="threat-item">
                            <strong>Threat Level:</strong> {taskData.threat_intelligence.threat_level}
                          </div>
                          <div className="threat-item">
                            <strong>Total Threats:</strong> {taskData.threat_intelligence.total_threats}
                          </div>
                          <div className="threat-item">
                            <strong>Critical Bombs:</strong> {taskData.threat_intelligence.critical_bombs}
                          </div>
                        </div>
                        {taskData.threat_intelligence.recommendations && (
                          <div className="recommendations">
                            <h6>Recommendations:</h6>
                            <ul>
                              {taskData.threat_intelligence.recommendations.map((rec, idx) => (
                                <li key={idx}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {taskData.file_results && (
                      <div className="file-results">
                        <h6><i className="fas fa-file"></i> File Results</h6>
                        <div className="file-list">
                          {taskData.file_results.map((file, idx) => (
                            <div key={idx} className="file-item">
                              <div className="file-header">
                                <strong>{file.file_name}</strong>
                                <span className={`badge badge-${file.threat_level === 'CRITICAL' ? 'danger' : 'warning'}`}>
                                  {file.threat_level}
                                </span>
                              </div>
                              <div className="file-stats">
                                <span>Issues: {file.issues_count}</span>
                                <span>Lines: {file.lines_scanned}</span>
                                <span>Critical: {file.critical_threats}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowTaskModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VS Code Instructions Modal */}
      {showInstructionsModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-book"></i> Threat Instructions
                </h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => setShowInstructionsModal(false)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                {Object.entries(instructions).map(([scanId, instructionData]) => (
                  <div key={scanId} className="instructions-section">
                    <h6><i className="fas fa-folder"></i> Scan ID: {scanId}</h6>
                    <div className="instructions-content">
                      <div className="instruction-item">
                        <h6><i className="fas fa-tools"></i> Setup Instructions</h6>
                        <pre className="instruction-code">{instructionData.setup_instructions || 'No setup instructions available'}</pre>
                      </div>
                      <div className="instruction-item">
                        <h6><i className="fas fa-cog"></i> Configuration</h6>
                        <pre className="instruction-code">{instructionData.configuration || 'No configuration available'}</pre>
                      </div>
                      <div className="instruction-item">
                        <h6><i className="fas fa-play"></i> Usage Instructions</h6>
                        <pre className="instruction-code">{instructionData.usage_instructions || 'No usage instructions available'}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowInstructionsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VS Code Workspace Modal */}
      {showWorkspaceModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-folder-open"></i> Threat Workspace
                </h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => setShowWorkspaceModal(false)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                {Object.entries(workspaceData).map(([scanId, workspaceInfo]) => (
                  <div key={scanId} className="workspace-section">
                    <h6><i className="fas fa-folder"></i> Scan ID: {scanId}</h6>
                    <div className="workspace-content">
                      <div className="workspace-item">
                        <h6><i className="fas fa-file-code"></i> Workspace Configuration</h6>
                        <pre className="workspace-code">{JSON.stringify(workspaceInfo.workspace_config || {}, null, 2)}</pre>
                      </div>
                      <div className="workspace-item">
                        <h6><i className="fas fa-cog"></i> Settings</h6>
                        <pre className="workspace-code">{JSON.stringify(workspaceInfo.settings || {}, null, 2)}</pre>
                      </div>
                      <div className="workspace-item">
                        <h6><i className="fas fa-list"></i> Extensions</h6>
                        <pre className="workspace-code">{JSON.stringify(workspaceInfo.extensions || [], null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowWorkspaceModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copilot Prompts Modal */}
      {showCopilotPromptsModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-file-code"></i> Copilot Prompts
                </h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => setShowCopilotPromptsModal(false)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                {Object.entries(copilotPrompts).map(([scanId, prompts]) => (
                  <div key={scanId} className="copilot-prompts-section">
                    <h6><i className="fas fa-folder"></i> Scan ID: {scanId}</h6>
                    <div className="prompts-list">
                      {prompts.map((prompt, index) => (
                        <div key={index} className="prompt-item">
                          <div className="prompt-header">
                            <strong><i className="fas fa-file"></i> {prompt.file_name}</strong>
                            <span className={`badge badge-${prompt.severity === 'CRITICAL' ? 'danger' : 'warning'}`}>
                              {prompt.severity}
                            </span>
                            <span className="badge badge-info">{prompt.issues_count} issues</span>
                          </div>
                          <div className="prompt-content">
                            <div className="prompt-actions">
                              <button 
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(prompt.prompt_text);
                                  alert('Prompt copied to clipboard!');
                                }}
                                title="Copy Prompt to Clipboard"
                              >
                                <i className="fas fa-copy"></i> Copy Prompt
                              </button>
                              <button 
                                className="btn btn-outline-info btn-sm"
                                onClick={() => {
                                  const textArea = document.createElement('textarea');
                                  textArea.value = prompt.prompt_text;
                                  document.body.appendChild(textArea);
                                  textArea.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(textArea);
                                  alert('Prompt copied to clipboard!');
                                }}
                                title="Copy Prompt (Fallback)"
                              >
                                <i className="fas fa-clipboard"></i> Copy (Fallback)
                              </button>
                            </div>
                            <div className="prompt-text-container">
                              <h6><i className="fas fa-code"></i> Prompt Text:</h6>
                              <pre className="prompt-text">{prompt.prompt_text}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowCopilotPromptsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terraform Prompt Modal */}
      {showTerraformModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-file-code"></i> Threat Copilot Terraform Prompt
                </h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => setShowTerraformModal(false)}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="terraform-prompt-section">
                  {/* Hostname Input Section */}
                  <div className="hostname-input-section mb-3">
                    <div className="row">
                      <div className="col-md-6">
                        <label htmlFor="hostnameInput" className="form-label">
                          <i className="fas fa-server"></i> Target Hostname:
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="hostnameInput"
                          placeholder="Enter target hostname (e.g., web-server-01, api-gateway-prod)"
                          value={hostname}
                          onChange={handleHostnameChange}
                        />
                        <div className="form-text">
                          Enter the hostname that will be used in the Terraform configuration. 
                          This will replace the placeholder in the prompt.
                        </div>
                      </div>
                      <div className="col-md-6 d-flex align-items-end">
                        <div className="alert alert-info mb-0">
                          <i className="fas fa-info-circle"></i>
                          <strong>Tip:</strong> The hostname will be automatically updated in the prompt below as you type.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="prompt-actions mb-3">
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(terraformContent);
                        alert('Terraform prompt copied to clipboard!');
                      }}
                      title="Copy Prompt to Clipboard"
                    >
                      <i className="fas fa-copy"></i> Copy Prompt
                    </button>
                    <button 
                      className="btn btn-outline-info btn-sm"
                      onClick={() => {
                        const textArea = document.createElement('textarea');
                        textArea.value = terraformContent;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        alert('Terraform prompt copied to clipboard!');
                      }}
                      title="Copy Prompt (Fallback)"
                    >
                      <i className="fas fa-clipboard"></i> Copy (Fallback)
                    </button>
                  </div>
                  <div className="prompt-text-container">
                    <h6><i className="fas fa-code"></i> Terraform Prompt:</h6>
                    <pre className="prompt-text" style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: '1rem', 
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word'
                    }}>
                      {terraformContent}
                    </pre>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowTerraformModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Popup Modal */}
      {showActionPopup && selectedActionVulnerability && (
        <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-lg" style={{ zIndex: 1055 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-cogs me-2"></i>
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
                      <i className="fas fa-bug me-2"></i>
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
                      <i className="fas fa-cog me-2"></i>
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
                    <i className="fas fa-info-circle me-2 mt-1"></i>
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
                  disabled={generatingActionPrompt || !selectedSPK || !selectedRepository || !repoUrl}
                >
                  {generatingActionPrompt ? (
                    <>
                      <i className="fas fa-spinner fa-spin me-2"></i>
                      Generating...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-magic me-2"></i>
                      Generate Comprehensive Prompt
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
        </div>
      )}
    </div>
  );
};

export default CopilotRemediation;