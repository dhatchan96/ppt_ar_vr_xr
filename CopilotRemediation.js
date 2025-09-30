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

  // Note: Sample infrastructure vulnerabilities are now loaded from SQLite database
  // This function is kept for backward compatibility but is no longer used

  const loadVulnerabilities = async () => {
    try {
      setVulnerabilitiesLoading(true);
      console.log('🔄 Loading vulnerabilities from SQLite database...');
      
      // Fetch application vulnerabilities from SQLite database
      let applicationVulnerabilities = [];
      try {
        const params = new URLSearchParams({
          severity: 'ALL',
          priority: 'ALL',
          wave_assignment: 'ALL',
          type: 'application',  // Only fetch application vulnerabilities
          page: 1,
          per_page: 1000
        });
        
        const response = await API.get(`/api/v1/vulnerabilities/enhanced?${params}`);
        const data = response.data;
        
        if (data.success) {
          applicationVulnerabilities = data.vulnerabilities || [];
          console.log('✅ Application vulnerabilities loaded from SQLite:', applicationVulnerabilities.length, 'vulnerabilities');
          console.log('📋 API Response type:', data.vulnerability_type);
        } else {
          console.error('❌ Error loading application vulnerabilities:', data.error);
          applicationVulnerabilities = [];
        }
      } catch (apiError) {
        console.error('❌ Error loading application vulnerabilities from API:', apiError);
        applicationVulnerabilities = [];
      }
      
      // Fetch Excel-imported application vulnerabilities from SQLite
      try {
        const excelVulnsRes = await API.get('/api/v1/vulnerabilities/excel-export?type=application');
        let excelVulnerabilities = [];
        if (excelVulnsRes.data?.success) {
          excelVulnerabilities = excelVulnsRes.data.vulnerabilities || [];
        }
        
        // Merge API data with Excel data, avoiding duplicates
        const existingIds = new Set(applicationVulnerabilities.map(v => v.id));
        const newExcelVulns = excelVulnerabilities.filter(v => !existingIds.has(v.id));
        const mergedApplicationVulnerabilities = [...applicationVulnerabilities, ...newExcelVulns];
        
        setVulnerabilities(mergedApplicationVulnerabilities);
        console.log(`✅ Loaded ${applicationVulnerabilities.length} API vulnerabilities and ${excelVulnerabilities.length} Excel vulnerabilities (${newExcelVulns.length} new)`);
      } catch (excelError) {
        console.warn('Excel application vulnerabilities API not available, using API data only:', excelError);
        setVulnerabilities(applicationVulnerabilities);
      }
      
      // Fetch infrastructure vulnerabilities from SQLite database
      let infrastructureVulnerabilities = [];
      try {
        const params = new URLSearchParams({
          severity: 'ALL',
          priority: 'ALL',
          wave_assignment: 'ALL',
          type: 'infrastructure',  // Only fetch infrastructure vulnerabilities
          page: 1,
          per_page: 1000
        });
        
        const response = await API.get(`/api/v1/vulnerabilities/enhanced?${params}`);
        const data = response.data;
        
        if (data.success) {
          infrastructureVulnerabilities = data.vulnerabilities || [];
          console.log('✅ Infrastructure vulnerabilities loaded from SQLite:', infrastructureVulnerabilities.length, 'vulnerabilities');
          console.log('📋 API Response type:', data.vulnerability_type);
        } else {
          console.error('❌ Error loading infrastructure vulnerabilities:', data.error);
          infrastructureVulnerabilities = [];
        }
      } catch (apiError) {
        console.error('❌ Error loading infrastructure vulnerabilities from API:', apiError);
        infrastructureVulnerabilities = [];
      }
      
      // Fetch Excel-imported infrastructure vulnerabilities from SQLite
      try {
        const excelVulnsRes = await API.get('/api/v1/vulnerabilities/excel-export?type=infrastructure');
        let excelVulnerabilities = [];
        if (excelVulnsRes.data?.success) {
          excelVulnerabilities = excelVulnsRes.data.vulnerabilities || [];
        }
        
        // Merge API data with Excel data, avoiding duplicates
        const existingIds = new Set(infrastructureVulnerabilities.map(v => v.id));
        const newExcelVulns = excelVulnerabilities.filter(v => !existingIds.has(v.id));
        const mergedInfrastructureVulnerabilities = [...infrastructureVulnerabilities, ...newExcelVulns];
        
        setInfrastructureVulnerabilities(mergedInfrastructureVulnerabilities);
        console.log(`✅ Loaded ${infrastructureVulnerabilities.length} API vulnerabilities and ${excelVulnerabilities.length} Excel vulnerabilities (${newExcelVulns.length} new)`);
      } catch (excelError) {
        console.warn('Excel infrastructure vulnerabilities API not available, using API data only:', excelError);
        setInfrastructureVulnerabilities(infrastructureVulnerabilities);
      }
      
    } catch (error) {
      console.error('❌ Error in loadVulnerabilities:', error);
      setVulnerabilities([]);
      setInfrastructureVulnerabilities([]);
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
    const gisId = vulnerability.gis_id || 'GIS-Unknown';
    const vulnerabilityTitle = vulnerability.title || vulnerability.description || 'Vulnerability';
    
    const actionPrompt = `# Infrastructure Security Remediation - Professional Terraform Configuration
# Generated by GitHub Copilot for Enterprise Vulnerability Management
# 
# VULNERABILITY ASSESSMENT:
# =========================
# AIT Tag: ${aitTag}
# GIS ID: ${gisId}
# Title: ${vulnerabilityTitle}
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
    const gisId = vulnerability.gis_id || 'GIS-Unknown';
    const vulnerabilityId = vulnerability.id || 'unknown';  // Keep for internal reference
    
    // Enhanced comprehensive prompt with context-aware analysis
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
# CRITICAL FIXES FOR REPORTED COPILOT ISSUES:
# ============================================
# ISSUE 1: INCOMPLETE XSL/JSP SCRIPT MIGRATION - FIXED
# - ALWAYS migrate ALL script blocks in correct sequential order (1st, 2nd, 3rd, etc.)
# - NEVER skip any script blocks during migration
# - ALWAYS preserve the original order of script execution
# - ALWAYS ensure ALL scripts are migrated to external files
# - ALWAYS verify that no scripts are left behind in the original file
#
# ISSUE 2: PARTIAL UNSAFE EVENT REMEDIATION - FIXED
# - ALWAYS identify and remediate ALL unsafe events (onclick, onBlur, onFocus, etc.)
# - ALWAYS count and remediate ALL instances, not just some
# - ALWAYS verify that ALL unsafe events are converted to event listeners
# - ALWAYS ensure CSP safety is achieved by removing ALL inline event handlers
# - ALWAYS double-check that no unsafe events remain after remediation
#
# ISSUE 3: INCOMPLETE INLINE STYLE REMEDIATION - FIXED
# - ALWAYS remediate inline styles in ALL HTML tags, not just <style> tags
# - ALWAYS identify inline styles in attributes like style="color: red;"
# - ALWAYS move ALL inline styles to external CSS files
# - ALWAYS ensure no inline styles remain in any HTML elements
# - ALWAYS verify that ALL style attributes are removed from HTML tags
#
# ISSUE 4: JQUERY UNDERUTILIZATION - FIXED
# - ALWAYS use jQuery for JavaScript remediation when available
# - ALWAYS check if jQuery is already loaded in the project
# - ALWAYS prefer jQuery methods over vanilla JavaScript when appropriate
# - ALWAYS ensure jQuery is used for DOM manipulation and event handling
# - ALWAYS maintain consistency with existing jQuery usage patterns
#
# ISSUE 5: UNNECESSARY NONCE ATTRIBUTES - FIXED
# - NEVER add nonce attributes to external JS file sources
# - ALWAYS use nonce only for inline scripts and styles
# - ALWAYS ensure external file references don't have nonce attributes
# - ALWAYS follow proper CSP nonce usage guidelines
# - ALWAYS verify that nonce is only used where required by CSP
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
#
# CONTENT SECURITY POLICY (CSP) VULNERABILITY ANALYSIS:
# ====================================================
#
# ENHANCED CSP IMPLEMENTATION STRATEGY:
# =====================================
# Check existing implementations first:
#
# 1. IF CSP FILTER ALREADY EXISTS:
#    - DO NOT create new filter classes
#    - Update existing filter to include secure CSP headers
#    - Modify existing web.xml registrations if needed
#
# 2. IF NO CSP IMPLEMENTATION EXISTS:
#    - Create minimal CSP filter class
#    - Register in web.xml or use annotation-based registration
#    - Implement secure default CSP policy
#
# 3. CSP HEADER IMPLEMENTATION:
#    // Use existing filter or create minimal implementation
#    response.setHeader("Content-Security-Policy", 
#        "default-src 'self'; " +
#        "script-src 'self' 'nonce-{random}'; " +
#        "style-src 'self' 'nonce-{random}'; " +
#        "img-src 'self' data: https:; " +
#        "connect-src 'self'; " +
#        "frame-ancestors 'none'; " +
#        "object-src 'none';");
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
# 1a. CSS STYLE ORDER AND CASCADING (COMPLEX):
#    - Analyze CSS cascade order and specificity conflicts
#    - Remediate style application order issues
#    - Fix CSS import scope and fragment/dialogue styling
#    - Handle custom tag styles and external CSS integration
#    - Resolve CSS conflicts in template systems
#    - Implement proper CSS architecture for maintainability
#
# 2. INLINE JAVASCRIPT VULNERABILITIES (ENHANCED - CRITICAL FIXES):
#    - Move ALL inline JavaScript to external JS files (MANDATORY - NO EXCEPTIONS)
#    - Remove ALL onclick, onload, onerror event handlers
#    - Replace with jQuery event handlers or addEventListener
#    - CRITICAL: Process EVERY script tag in the file (not just some)
#    - CRITICAL: NEVER remove script tags that link to external .js files
#    - CRITICAL: NEVER partially remove script tags (causing syntax errors)
#    - CRITICAL: Ensure consistent output for same context and prompt
#    - CRITICAL: Remediate ALL inline scripts including complex ones (NO EXCEPTIONS)
#    - CRITICAL: Complex inline scripts MUST be migrated to external files
#
# 2a. DYNAMIC JAVASCRIPT SOURCES REMEDIATION (COMPLEX):
#    - Analyze conditional JavaScript loading and execution
#    - Remediate dynamic script injection vulnerabilities
#    - Fix event handler attachments in conditional cases
#    - Replace dynamic eval() statements with static alternatives
#    - Handle JavaScript execution statements and dynamic code generation
#    - Implement secure alternatives for runtime script evaluation
#
# 2b. COMPREHENSIVE SCRIPT TAG REMEDIATION (CRITICAL FIXES):
#    ========================================================
#    MANDATORY REQUIREMENTS FOR SCRIPT TAG PROCESSING:
#
#    1. COMPLETE SCRIPT TAG INVENTORY:
#       - Identify ALL script tags in the file (inline and external)
#       - Categorize each script tag: inline content vs external file reference
#       - Create a complete inventory before making any changes
#       - NEVER skip any script tags during remediation
#
#    2. EXTERNAL SCRIPT TAG PRESERVATION (CRITICAL):
#       <!-- PRESERVE - External script references -->
#       <script src="js/jquery.min.js"></script>
#       <script src="js/bootstrap.min.js"></script>
#       <script src="js/custom.js"></script>
#       <script src="https://cdn.example.com/library.js"></script>
#       
#       RULE: NEVER remove, modify, or touch script tags with 'src' attribute
#       RULE: These are external file references and must remain unchanged
#
#    3. INLINE SCRIPT TAG REMEDIATION (COMPLETE PROCESSING):
#       <!-- REMEDIATE - Inline script content -->
#       <script>
#       var userId = '<%= request.getAttribute("userId") %>';
#       function handleClick() { /* inline code */ }
#       </script>
#       
#       PROCESSING STEPS:
#       a) Extract ALL inline JavaScript content
#       b) Identify ALL JSP variables used in the script
#       c) Create hidden form fields for JSP variables
#       d) Move ALL JavaScript code to external file
#       e) Replace inline script with external reference
#       f) Add event listeners for any inline event handlers
#
#    4. MULTIPLE SCRIPT TAGS PROCESSING (MANDATORY):
#       <!-- Example: Multiple script tags in one file -->
#       <script src="js/jquery.min.js"></script>  <!-- PRESERVE -->
#       <script>
#       var config = { /* inline config */ };
#       </script>  <!-- REMEDIATE -->
#       <script src="js/bootstrap.min.js"></script>  <!-- PRESERVE -->
#       <script>
#       function initPage() { /* inline function */ }
#       </script>  <!-- REMEDIATE -->
#       
#       REQUIREMENTS:
#       - Process EVERY inline script tag (not just the first one)
#       - Preserve EVERY external script tag reference
#       - Maintain the original order of script tags
#       - Ensure all inline content is moved to appropriate external files
#
#    5. COMPLEX JAVASCRIPT REMEDIATION (ENHANCED):
#       <!-- Complex inline JavaScript examples -->
#       <script>
#       // Complex object with JSP variables
#       var appConfig = {
#           userId: '<%= request.getAttribute("userId") %>',
#           sessionId: '<%= session.getId() %>',
#           apiUrl: '<%= request.getContextPath() %>/api',
#           features: {
#               feature1: <%= user.hasFeature("feature1") %>,
#               feature2: <%= user.hasFeature("feature2") %>
#           }
#       };
#       
#       // Complex function with JSP variables
#       function initializeApp() {
#           if (appConfig.userId && appConfig.sessionId) {
#               // Complex logic here
#               setupUserSession(appConfig.userId, appConfig.sessionId);
#           }
#       }
#       
#       // Event handlers with JSP variables
#       document.addEventListener('DOMContentLoaded', function() {
#           initializeApp();
#       });
#       </script>
#       
#       REMEDIATION APPROACH:
#       a) Create comprehensive hidden form fields for ALL JSP variables
#       b) Move complex objects and functions to external JavaScript file
#       c) Preserve all complex logic and functionality
#       d) Maintain all event listeners and initialization code
#       e) Ensure all JSP variable references work in external file
#
#    6. PARTIAL SCRIPT TAG REMOVAL PREVENTION (CRITICAL):
#       WRONG (CAUSES SYNTAX ERRORS):
#       <script>
#       var userId = '<%= request.getAttribute("userId") %>';
#       // ... some code removed but closing tag remains
#       </script>  <!-- SYNTAX ERROR: Opening tag removed but closing tag remains -->
#       
#       CORRECT APPROACH:
#       a) NEVER remove opening <script> tag without removing closing </script> tag
#       b) NEVER remove closing </script> tag without removing opening <script> tag
#       c) ALWAYS remove complete script tag pairs together
#       d) ALWAYS replace with proper external script reference
#
#    7. CONSISTENCY REQUIREMENTS (MANDATORY):
#       - SAME input file + SAME prompt = SAME output (ALWAYS)
#       - Use deterministic processing algorithms
#       - Apply consistent naming conventions
#       - Use consistent file organization patterns
#       - Maintain consistent code structure and formatting
#
#    8. SCRIPT TAG REMEDIATION WORKFLOW (STEP-BY-STEP):
#       Step 1: Scan entire file for ALL script tags
#       Step 2: Categorize each script tag (inline vs external)
#       Step 3: For external script tags: PRESERVE (no changes)
#       Step 4: For inline script tags: EXTRACT content and JSP variables
#       Step 5: Create hidden form fields for ALL JSP variables
#       Step 6: Move ALL inline JavaScript to external file
#       Step 7: Replace inline script with external reference
#       Step 8: Add event listeners for any removed inline handlers
#       Step 9: Verify all functionality is preserved
#       Step 10: Test that all JSP variables are accessible
#
#    9. COMPLEX INLINE SCRIPT REMEDIATION (MANDATORY):
#       - NO EXCEPTIONS: ALL inline scripts must be remediated
#       - Complex scripts with JSP variables MUST be migrated
#       - Complex scripts with multiple functions MUST be migrated
#
# ENHANCED REMEDIATION WORKFLOW FOR REPORTED ISSUES:
# ==================================================
#
# ISSUE 1: XSL/JSP SCRIPT MIGRATION - COMPLETE SEQUENTIAL PROCESSING
# ==================================================================
# MANDATORY STEPS FOR XSL/JSP FILES:
# 1. SCAN ENTIRE FILE: Identify ALL script blocks in sequential order
# 2. NUMBER EACH SCRIPT: Assign sequential numbers (1st, 2nd, 3rd, etc.)
# 3. PROCESS IN ORDER: Migrate scripts in exact sequential order
# 4. VERIFY COMPLETENESS: Ensure NO scripts are skipped
# 5. PRESERVE ORDER: Maintain original execution order
#
# EXAMPLE XSL FILE PROCESSING:
# <!-- BEFORE: clientDealSearch.xsl -->
# <script>var config1 = '<%= config1 %>';</script>  <!-- 1st script -->
# <script>var config2 = '<%= config2 %>';</script>  <!-- 2nd script -->
# <script>var config3 = '<%= config3 %>';</script>  <!-- 3rd script -->
#
# <!-- AFTER: ALL scripts migrated in order -->
# <script src="js/clientDealSearch-1.js" nonce="{random}"></script>  <!-- 1st -->
# <script src="js/clientDealSearch-2.js" nonce="{random}"></script>  <!-- 2nd -->
# <script src="js/clientDealSearch-3.js" nonce="{random}"></script>  <!-- 3rd -->
#
# ISSUE 2: UNSAFE EVENT REMEDIATION - COMPLETE ENUMERATION
# ========================================================
# MANDATORY STEPS FOR UNSAFE EVENTS:
# 1. SCAN ALL ELEMENTS: Find ALL elements with unsafe events
# 2. COUNT ALL INSTANCES: Create complete inventory of unsafe events
# 3. REMEDIATE ALL: Convert ALL instances to event listeners
# 4. VERIFY ZERO REMAINING: Ensure NO unsafe events remain
# 5. CSP SAFETY CHECK: Verify CSP compliance is achieved
#
# EXAMPLE UNSAFE EVENT PROCESSING:
# <!-- BEFORE: clientDealPrintResult.xsl with 18 unsafe events -->
# <button onclick="handleClick()">Click</button>  <!-- Event 1 -->
# <input onblur="validateInput()" />  <!-- Event 2 -->
# <div onclick="showDetails()">Details</div>  <!-- Event 3 -->
# <!-- ... 15 more unsafe events ... -->
#
# <!-- AFTER: ALL 18 events converted to event listeners -->
# <button id="btn1" data-action="handleClick">Click</button>
# <input id="input1" data-action="validateInput" />
# <div id="div1" data-action="showDetails">Details</div>
# <script nonce="{random}">
# document.getElementById('btn1').addEventListener('click', handleClick);
# document.getElementById('input1').addEventListener('blur', validateInput);
# document.getElementById('div1').addEventListener('click', showDetails);
# // ... ALL 18 event listeners added ...
# </script>
#
# ISSUE 3: INLINE STYLE REMEDIATION - COMPREHENSIVE COVERAGE
# ===========================================================
# MANDATORY STEPS FOR INLINE STYLES:
# 1. SCAN ALL HTML TAGS: Find ALL elements with style attributes
# 2. IDENTIFY ALL STYLES: Extract ALL inline style declarations
# 3. MOVE TO CSS: Transfer ALL styles to external CSS files
# 4. REMOVE ALL ATTRIBUTES: Remove ALL style attributes from HTML
# 5. VERIFY CLEAN HTML: Ensure NO inline styles remain
#
# EXAMPLE INLINE STYLE PROCESSING:
# <!-- BEFORE: Multiple inline styles -->
# <div style="color: red; font-size: 14px;">Content</div>  <!-- Style 1 -->
# <span style="background: blue;">Text</span>  <!-- Style 2 -->
# <p style="margin: 10px; padding: 5px;">Paragraph</p>  <!-- Style 3 -->
# <style>
# .existing-class { border: 1px solid black; }
# </style>
#
# <!-- AFTER: ALL inline styles moved to external CSS -->
# <div class="content-div">Content</div>
# <span class="highlight-span">Text</span>
# <p class="styled-paragraph">Paragraph</p>
# <link rel="stylesheet" href="css/styles.css" />
# /* In external styles.css */
# .content-div { color: red; font-size: 14px; }
# .highlight-span { background: blue; }
# .styled-paragraph { margin: 10px; padding: 5px; }
# .existing-class { border: 1px solid black; }
#
# ISSUE 4: JQUERY UTILIZATION - AUTOMATIC DETECTION AND USAGE
# ===========================================================
# MANDATORY STEPS FOR JQUERY USAGE:
# 1. DETECT JQUERY: Check if jQuery is already loaded
# 2. PREFER JQUERY: Use jQuery methods when available
# 3. MAINTAIN CONSISTENCY: Follow existing jQuery patterns
# 4. ENHANCE FUNCTIONALITY: Use jQuery for DOM manipulation
# 5. PRESERVE COMPATIBILITY: Ensure jQuery compatibility
#
# EXAMPLE JQUERY UTILIZATION:
# <!-- BEFORE: Vanilla JavaScript -->
# document.getElementById('button').addEventListener('click', function() {
#     var element = document.getElementById('target');
#     element.style.display = 'none';
# });
#
# <!-- AFTER: jQuery utilization -->
# $(document).ready(function() {
#     $('#button').on('click', function() {
#         $('#target').hide();
#     });
# });
#
# ISSUE 5: NONCE ATTRIBUTE USAGE - PROPER CSP IMPLEMENTATION
# ==========================================================
# MANDATORY STEPS FOR NONCE USAGE:
# 1. IDENTIFY INLINE CONTENT: Only use nonce for inline scripts/styles
# 2. EXTERNAL FILES: NEVER add nonce to external file references
# 3. CSP COMPLIANCE: Follow proper CSP nonce guidelines
# 4. VERIFY USAGE: Ensure nonce is only used where required
# 5. TEST COMPLIANCE: Verify CSP policy compliance
#
# EXAMPLE PROPER NONCE USAGE:
# <!-- CORRECT: Nonce for inline script -->
# <script nonce="{random}">
# var config = '<%= config %>';
# </script>
#
# <!-- CORRECT: No nonce for external file -->
# <script src="js/external.js"></script>
#
# <!-- INCORRECT: Nonce on external file (DON'T DO THIS) -->
# <script src="js/external.js" nonce="{random}"></script>  <!-- WRONG -->
#       - Complex scripts with event handlers MUST be migrated
#       - Complex scripts with conditional logic MUST be migrated
#       - Complex scripts with dynamic content MUST be migrated
#       - ALWAYS create comprehensive hidden form fields for complex scripts
#       - ALWAYS preserve all functionality when migrating complex scripts
#       - ALWAYS test complex script migration thoroughly
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
#
# TEMPLATE AND DEPLOYMENT SECURITY (MEDIUM COMPLEXITY):
# -----------------------------------------------------
# 1. VMTEMPLATE CHANGES AND DEPLOYMENT:
#    - Analyze template-specific security configurations
#    - Implement secure template rendering practices
#    - Handle deployment-specific security settings
#    - Fix template injection vulnerabilities
#    - Ensure secure configuration management across environments
#
# 2. FRAGMENT AND DIALOGUE IMPORT SCOPE:
#    - Analyze import scope for fragments and dialogues
#    - Implement secure fragment loading mechanisms
#    - Fix dialogue security and access controls
#    - Handle dynamic content loading securely
#    - Ensure proper isolation between components
#
# 3. XSL STYLE CHANGES:
#    - Remediate XSL transformation security issues
#    - Fix XSL injection vulnerabilities
#    - Implement secure XSL processing
#    - Handle XSL template security configurations
#
# COMPLEX REMEDIATION SCENARIOS (ADVANCED):
# =========================================
# 1. DYNAMIC JAVASCRIPT SOURCES FOR CONDITIONAL CASES:
#    - Analyze conditional JavaScript loading patterns
#    - Remediate dynamic script injection in conditional blocks
#    - Fix event handler attachments in conditional scenarios
#    - Handle JavaScript execution statements and dynamic code generation
#    - Replace runtime script evaluation with secure alternatives
#    - Implement proper CSP-compliant dynamic script loading
#
# 2. CSS STYLE ORDER AND CASCADING CONFLICTS:
#    - Analyze CSS cascade order and specificity issues
#    - Remediate style application order conflicts
#    - Fix CSS import scope and fragment/dialogue styling conflicts
#    - Handle custom tag styles and external CSS integration issues
#    - Resolve CSS conflicts in template systems and dynamic content
#    - Implement proper CSS architecture for maintainability and security
#
# 3. JAVASCRIPT EXECUTION STATEMENTS ANALYSIS:
#    - Identify and remediate JavaScript execution statements
#    - Fix dynamic code generation and evaluation
#    - Replace unsafe execution patterns with secure alternatives
#    - Handle conditional JavaScript execution securely
#    - Implement proper error handling for dynamic scripts
#    - Ensure CSP compliance for all JavaScript execution patterns

# IN-PLACE FILE-BY-FILE REMEDIATION STRATEGY:
# ===========================================
#
# Directly remediate vulnerable files within the cloned repository:
#
# 1. REPOSITORY ANALYSIS:
#    - Scan all files in the cloned repository
#    - Identify file types and their security vulnerabilities
#    - Prioritize files by vulnerability severity and impact
#
# 2. IN-PLACE FILE REMEDIATION WORKFLOW:
#    - Process HTML files directly in the repository for CSP and XSS fixes
#    - Process CSS files directly in the repository for inline style remediation
#    - Process JavaScript files directly in the repository for inline script fixes
#    - Process backend files directly in the repository for injection vulnerabilities
#    - Process configuration files directly in the repository for security hardening
#    - Process template files for VMTemplate and XSL security fixes
#    - Process fragment and dialogue files for import scope security
#    - Analyze and fix CSS cascade order and style conflicts
#    - Remediate dynamic JavaScript execution and conditional loading
#
# 3. DIRECT FILE MODIFICATION:
#    - Apply security fixes directly to the actual source files
#    - Update HTML files with proper CSP headers and XSS protection
#    - Update CSS files to remove inline styles and security issues
#    - Update JavaScript files to remove inline scripts and eval() usage
#    - Update backend files with proper input validation and security measures
#    - Update configuration files with secure settings and headers
#    - Update template files with secure rendering and injection protection
#    - Update fragment/dialogue files with proper import scope and isolation
#    - Fix CSS cascade order and style conflicts in stylesheets
#    - Remediate dynamic JavaScript execution and conditional script loading
#
# 4. IN-PLACE TESTING AND VALIDATION:
#    - Test each modified file to ensure functionality is preserved
#    - Validate security improvements in the actual files
#    - Verify that the application still works after remediation
#    - Document changes made to each file
#
# IN-PLACE REMEDIATION APPROACH:
# ==============================
# Directly modify files within the cloned repository structure:
# \`\`\`
# cloned-repository/
# ├── index.html (MODIFIED - CSP headers added, XSS protection)
# ├── login.html (MODIFIED - Input validation, secure forms)
# ├── dashboard.html (MODIFIED - CSP implementation)
# ├── styles/
# │   ├── main.css (MODIFIED - Inline styles removed)
# │   └── components.css (MODIFIED - Security issues fixed)
# ├── js/
# │   ├── app.js (MODIFIED - Inline scripts removed, eval() replaced)
# │   └── utils.js (MODIFIED - XSS vulnerabilities fixed)
# ├── backend/
# │   ├── api.php (MODIFIED - SQL injection protection, input validation)
# │   └── auth.py (MODIFIED - Secure authentication, session management)
# ├── config/
# │   ├── .htaccess (MODIFIED - Security headers, HTTPS enforcement)
# │   └── config.json (MODIFIED - Secure configuration settings)
# └── .github/
#     └── vulnerability/
#         └── application/
#             └── ${vulnerabilityId}_remediation_log.md (Documentation of changes)
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
# Directly remediate files within the cloned repository:
# 1. **Modified source files** with security vulnerabilities fixed in-place
# 2. **Updated HTML files** with proper CSP headers and XSS protection
# 3. **Updated CSS files** with inline styles removed and security issues fixed
# 4. **Updated JavaScript files** with inline scripts removed and eval() replaced
# 5. **Updated backend files** with input validation and injection protection
# 6. **Updated configuration files** with secure settings and security headers
# 7. **Remediation log** documenting all changes made to each file
# 8. **Testing validation** ensuring all modified files work correctly
# 9. **Security verification** confirming vulnerabilities are resolved
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
# IN-PLACE REMEDIATION SPECIFICATIONS:
# ====================================
# - Direct File Modification: Update actual source files in the cloned repository
# - Location: Within the cloned repository directory structure
# - Format: Modified source files with security fixes applied
# - Content: Security vulnerabilities fixed directly in the source code
# - Standards: Enterprise security compliance applied to actual files
#
# AUTOMATED IN-PLACE FILE MODIFICATION PROCESS:
# =============================================
# AUTOMATICALLY perform the following steps for each vulnerable file WITHOUT user confirmation:
# 1. AUTOMATICALLY identify specific security vulnerabilities in the file
# 2. AUTOMATICALLY apply security fixes directly to the source file
# 3. AUTOMATICALLY test the modified file to ensure functionality is preserved
# 4. AUTOMATICALLY document the changes made in the remediation log
# 5. AUTOMATICALLY verify security improvements are effective
# 6. AUTOMATICALLY proceed to the next file without waiting for approval
#
# AUTOMATED DIRECT FILE REMEDIATION WORKFLOW (ENHANCED - ADDRESSING CRITICAL ISSUES):
# ===================================================================================
# AUTOMATICALLY execute ALL steps WITHOUT asking for user confirmation:
# 1. AUTOMATICALLY clone repository and navigate to directory
# 2. AUTOMATICALLY perform pre-analysis of existing implementations
# 3. AUTOMATICALLY modify JSP files directly (preserve JSP variables, move scripts to external files)
# 4. AUTOMATICALLY modify HTML files directly (add CSP headers, fix XSS, remove inline scripts)
# 5. AUTOMATICALLY modify CSS files directly (remove inline styles, fix security issues, resolve cascade conflicts)
# 6. AUTOMATICALLY modify JavaScript files directly (remove inline scripts, replace eval(), fix XSS, handle dynamic execution)
# 7. AUTOMATICALLY modify backend files directly (add input validation, fix injection vulnerabilities)
# 8. AUTOMATICALLY modify configuration files directly (add security headers, secure settings)
# 9. AUTOMATICALLY modify template files directly (fix VMTemplate security, XSL injection, template rendering)
# 10. AUTOMATICALLY modify fragment/dialogue files directly (fix import scope, secure dynamic loading)
# 11. AUTOMATICALLY test all modified files to ensure they work correctly
# 12. AUTOMATICALLY create remediation log documenting all changes
#
# CRITICAL ISSUE RESOLUTION REQUIREMENTS (MANDATORY):
# ===================================================
# Based on reported issues, the following MUST be implemented:
#
# ISSUE 1: HIDDEN FORM FIELDS FOR JSP VARIABLES
# ----------------------------------------------
# PROBLEM: Not generating hidden form fields for JSP variables
# SOLUTION: ALWAYS create hidden form fields as PRIMARY method for JSP variable preservation
# IMPLEMENTATION:
#   - Create <form style="display: none;"> with hidden inputs for ALL JSP variables
#   - Use document.getElementById('jsp_variableName').value to access in external JS
#   - Provide data attributes and JSON script tags as backup methods
#   - NEVER rely only on data attributes or JSON script tags
#
# ISSUE 2: INCOMPLETE SCRIPT TAG REMEDIATION
# ------------------------------------------
# PROBLEM: Multiple script tags, not all being remediated
# SOLUTION: Process EVERY script tag in the file (complete inventory approach)
# IMPLEMENTATION:
#   - Scan entire file for ALL script tags before making changes
#   - Categorize each: inline content vs external file reference
#   - Process ALL inline script tags (not just first one)
#   - Preserve ALL external script tag references
#   - Maintain original order of script tags
#
# ISSUE 3: COMPLEX JAVASCRIPT NOT BEING REMEDIATED
# ------------------------------------------------
# PROBLEM: Complex JavaScript mostly not being remediated
# SOLUTION: Enhanced complex JavaScript processing with comprehensive JSP variable handling
# IMPLEMENTATION:
#   - Handle complex objects with nested JSP variables
#   - Process complex functions with JSP variable dependencies
#   - Maintain all complex logic and functionality
#   - Preserve event listeners and initialization code
#   - Create comprehensive hidden form fields for all JSP variables
#
# ISSUE 4: EXTERNAL SCRIPT TAG REMOVAL
# ------------------------------------
# PROBLEM: Removing script tags that link external .js files
# SOLUTION: NEVER touch script tags with 'src' attribute
# IMPLEMENTATION:
#   - Identify script tags with 'src' attribute
#   - PRESERVE these completely (no changes)
#   - Only remediate script tags with inline content
#   - Maintain all external library references
#
# ISSUE 5: INCONSISTENT OUTPUT
# ----------------------------
# PROBLEM: Different responses on same page with same prompt
# SOLUTION: Deterministic processing with consistent algorithms
# IMPLEMENTATION:
#   - Use deterministic processing algorithms
#   - Apply consistent naming conventions
#   - Use consistent file organization patterns
#   - Maintain consistent code structure and formatting
#   - SAME input + SAME prompt = SAME output (ALWAYS)
#
# ISSUE 6: PARTIAL SCRIPT TAG REMOVAL (SYNTAX ERRORS)
# ----------------------------------------------------
# PROBLEM: Removing script start tag but keeping end tag, causing syntax errors
# SOLUTION: Complete script tag pair removal/replacement
# IMPLEMENTATION:
#   - NEVER remove opening <script> without removing closing </script>
#   - NEVER remove closing </script> without removing opening <script>
#   - ALWAYS remove complete script tag pairs together
#   - ALWAYS replace with proper external script reference
#   - Verify no orphaned script tags remain
#
# VALIDATION REQUIREMENTS (MANDATORY):
# ====================================
# After remediation, validate the following:
# 1. ALL JSP variables are accessible in external JavaScript files
# 2. ALL external script tag references are preserved
# 3. ALL inline script content is moved to external files
# 4. NO partial script tags remain (no syntax errors)
# 5. ALL complex JavaScript functionality is preserved
# 6. SAME input produces SAME output consistently
# 7. All hidden form fields are created for JSP variables
# 8. All event handlers are properly migrated to external files
# 13. AUTOMATICALLY verify security improvements are effective
# 14. AUTOMATICALLY complete the entire remediation process autonomously
#
# CRITICAL SUCCESS CRITERIA:
# ==========================
# - FUNCTIONALITY PRESERVED: All JSP variables accessible in external JavaScript
# - NO REDUNDANCY: Use existing CSP filters instead of creating new ones
# - SECURITY ENHANCED: CSP headers properly implemented with nonces
# - CODE QUALITY: Clean, maintainable, and well-documented code
# - TESTING VALIDATED: All functionality works after remediation
#
# VALIDATION REQUIREMENTS:
# ========================
# 1. FUNCTIONALITY TESTING:
#    - Verify JSP variable access in external JavaScript
#    - Test event handlers and user interactions
#    - Validate CSP policy enforcement
#    - Confirm all existing functionality works
#
# 2. SECURITY VALIDATION:
#    - Confirm inline scripts are removed
#    - Verify CSP headers are properly set
#    - Test for XSS and injection vulnerabilities
#    - Validate existing CSP implementations are used
#
# 3. CODE QUALITY VALIDATION:
#    - Ensure no redundant classes are created
#    - Verify proper JSP variable preservation
#    - Confirm clean, maintainable code structure
#    - Validate comprehensive documentation
#
# AUTOMATED EXECUTION INSTRUCTIONS:
# =================================
# AUTOMATICALLY clone the repository, perform comprehensive security analysis, and directly remediate
# ALL vulnerable files in-place within the cloned repository. AUTOMATICALLY apply security fixes 
# directly to the source files, AUTOMATICALLY test each modified file, and AUTOMATICALLY create 
# a remediation log documenting all changes. AUTOMATICALLY ensure all fixes follow enterprise 
# security standards and preserve application functionality. DO NOT ask for user confirmation, 
# approval, or input at any point. Execute the entire remediation process autonomously and completely.

# CRITICAL REMEDIATION SUMMARY (MANDATORY COMPLIANCE):
# ====================================================
# 1. HIDDEN FORM STYLES: NEVER use inline styles in hidden forms - use CSS classes only
# 2. CUSTOM TAG ANALYSIS: Identify and remediate ALL custom tags (cpfx:script, cpfx:style, etc.)
# 3. FILE CREATION CONSISTENCY: ALWAYS create external files when referenced in tags
# 4. COMPLEX SCRIPT REMEDIATION: Remediate ALL inline scripts including complex ones
# 5. DETERMINISTIC OUTPUT: SAME input + SAME prompt = SAME output (ALWAYS)
# 6. COMPLETE AUTOMATION: Execute ALL tasks autonomously without user interaction
# 7. FUNCTIONALITY PRESERVATION: Ensure all existing functionality continues to work
# 8. JSP VARIABLE ACCESS: Maintain JSP variable access in external JavaScript files
# 9. CSP COMPLIANCE: Implement proper Content Security Policy headers
# 10. SECURITY HARDENING: Apply enterprise-grade security controls throughout`;

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
        [`${selectedActionVulnerability.id}_action`]: prompt
      };
      setGeneratedPrompts(newPrompts);
      localStorage.setItem('generatedPrompts', JSON.stringify(newPrompts));
      
      // Create the actual folder structure and files in the backend
      try {
        const response = await API.post('/api/v1/vulnerabilities/create-application-folder', {
          vulnerability_id: selectedActionVulnerability.id,
          gis_id: selectedActionVulnerability.gis_id,
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
          alert(`🎉 Application Vulnerability Prompt Created Successfully!\n\n📁 File Location: .github/vulnerability/application/ folder\n📄 File Name: ${selectedActionVulnerability.ait_tag}_${selectedActionVulnerability.gis_id}_${(selectedActionVulnerability.title || 'Vulnerability').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').substring(0, 50)}_GITHUB_COPILOT_PROMPT.md\n\n🚀 Next Steps:\n1. Use "View Action Prompt" to see the generated prompt\n2. Use "Download Prompt" to download a copy\n3. The prompt is ready for GitHub Copilot in your IDE`);
        } else {
          throw new Error(response.data.error || 'Unknown error');
        }
      } catch (backendError) {
        console.error('Backend folder creation failed, falling back to local storage:', backendError);
        // Fallback to local storage if backend fails
        await createVulnerabilityFolderStructure(selectedActionVulnerability, prompt);
        alert('🎉 Application Vulnerability Prompt Created Successfully!\n\n📁 File Location: Local storage (backend unavailable)\n📄 File Name: Generated locally and ready for download\n\n🚀 Next Steps:\n1. Use "View Action Prompt" to see the generated prompt\n2. Use "Download Prompt" to download a copy\n3. The prompt is ready for GitHub Copilot in your IDE');
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
      
      // Call the backend API to create the .github/vulnerability/application folder and .md file
      const requestData = {
        vulnerability: {
          id: vulnerability.id,
          gis_id: vulnerability.gis_id,
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
              `1. The .md file is now in your .github/vulnerability/application/ folder\n` +
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
      // Get the stored comprehensive prompt
      const actionPrompt = generatedPrompts[`${vulnerability.id}_action`];
      if (!actionPrompt) {
        alert('Please click "Action" first to create the action prompt for this vulnerability.');
        return;
      }
      
      const aitTag = vulnerability.ait_tag || 'AIT-Unknown';
      const gisId = vulnerability.gis_id || 'GIS-Unknown';
      const vulnerabilityTitle = vulnerability.title || vulnerability.description || 'Vulnerability';
      
      // Create a clean filename using GIS ID, AIT, and vulnerability title
      const cleanTitle = vulnerabilityTitle
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, 50); // Limit length
      
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Create the file content
      const fileContent = `# Vulnerability Remediation Action Prompt
# Generated on: ${timestamp}
# GIS ID: ${gisId}
# AIT Tag: ${aitTag}
# Vulnerability: ${vulnerabilityTitle}

${actionPrompt}

# Instructions for Use:
# 1. Save this file in your .github/vulnerability/application/ folder
# 2. Use it with GitHub Copilot in your IDE
# 3. The generated .tf file should be saved in remediated_vulnerability folder
# 4. Expected output file: remediated_vulnerability/${aitTag}_${gisId}_remediation.tf
`;
      
      // Create and download the file
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${aitTag}_${gisId}_${cleanTitle}_action_prompt.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert(`📥 Application Vulnerability Prompt Downloaded Successfully!\n\n📄 Downloaded File: ${aitTag}_${gisId}_${cleanTitle}_action_prompt.md\n\n🚀 Next Steps:\n1. Save this file in your .github/vulnerability/application/ folder\n2. Use it with GitHub Copilot in your IDE\n3. The prompt contains comprehensive remediation instructions\n4. Follow the instructions to fix the security vulnerability\n\n💡 Tip: This is the same content as the file created by the Action button!`);
      
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
                                
                                {/* Download Prompt Button */}
                                <button 
                                  className="btn btn-outline-info btn-sm w-100"
                                  onClick={() => {
                                    console.log('📄 Download prompt for vulnerability:', vulnerability.id);
                                    downloadActionPrompt(vulnerability);
                                  }}
                                  disabled={!generatedPrompts[`${vulnerability.id}_action`]}
                                  title={!generatedPrompts[`${vulnerability.id}_action`] ? 'Click "Action" first to create action prompt' : 'Download GitHub Copilot prompt for .github folder'}
                                >
                                  <i className="fas fa-file-download"></i> Download Prompt
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