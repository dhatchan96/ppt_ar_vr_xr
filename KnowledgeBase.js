import React, { useState, useEffect } from 'react';
import API from '../api';

const KnowledgeBase = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [mainTab, setMainTab] = useState('templates'); // 'templates' or 'usage'
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTemplate, setNewTemplate] = useState({
        title: '',
        description: '',
        category: 'application',
        content_type: 'url',
        content: '',
        file: null
    });
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    
    // Usage tracking state
    const [usageStats, setUsageStats] = useState(null);
    const [usageLoading, setUsageLoading] = useState(false);
    const [usageFilter, setUsageFilter] = useState('all'); // 'all', 'username', 'template'
    const [usageSearchTerm, setUsageSearchTerm] = useState('');
    const [selectedUsername, setSelectedUsername] = useState('');
    const [selectedTemplateForUsage, setSelectedTemplateForUsage] = useState('');

    useEffect(() => {
        fetchTemplates();
        if (mainTab === 'usage') {
            fetchUsageStats();
        }
    }, [mainTab]);

    // Fetch usage stats when filter changes
    useEffect(() => {
        if (mainTab === 'usage') {
            fetchUsageStats();
        }
    }, [usageFilter, selectedUsername, selectedTemplateForUsage]);

    // Auto-dismiss success messages after 5 seconds
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => {
                setSuccess(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await API.get('/api/knowledge-base/templates');
            if (response.data && response.data.success) {
                setTemplates(response.data.templates || []);
            } else {
                setError(response.data?.error || 'Failed to fetch templates');
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
            setError('Failed to load templates. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddTemplate = async () => {
        try {
            setError(null);
            setSuccess(null);
            const formData = new FormData();
            formData.append('title', newTemplate.title);
            formData.append('description', newTemplate.description);
            formData.append('category', newTemplate.category);
            formData.append('content_type', newTemplate.content_type);
            
            if (newTemplate.content_type === 'url') {
                formData.append('content', newTemplate.content);
            } else if (newTemplate.file) {
                formData.append('file', newTemplate.file);
            }

            const response = await API.post('/api/knowledge-base/templates', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data && response.data.success) {
                setShowAddModal(false);
                setNewTemplate({
                    title: '',
                    description: '',
                    category: 'application',
                    content_type: 'url',
                    content: '',
                    file: null
                });
                fetchTemplates();
                setSuccess('Template added successfully!');
                setShowAddModal(false);
            }
        } catch (error) {
            console.error('Error adding template:', error);
            setError('Error adding template: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDownloadTemplate = async (templateId, templateName) => {
        try {
            const response = await API.get(`/api/knowledge-base/templates/${templateId}/download`, {
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/markdown' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${templateName.replace(/\s+/g, '_')}_remediation_template.md`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading template:', error);
            setError('Error downloading template: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleViewTemplate = (template) => {
        setSelectedTemplate(template);
        setShowViewModal(true);
    };

    const filteredTemplates = templates.filter(template => {
        const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            template.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || template.category === filterCategory;
        const matchesTab = activeTab === 'all' || template.category === activeTab;
        
        return matchesSearch && matchesCategory && matchesTab;
    });

    const getCategoryColor = (category) => {
        const colors = {
            'application': '#007bff',
            'infrastructure': '#28a745',
            'security': '#dc3545',
            'network': '#ffc107',
            'database': '#6f42c1',
            'data-analysis': '#17a2b8',
            'migration': '#fd7e14'
        };
        return colors[category] || '#6c757d';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const fetchUsageStats = async () => {
        try {
            setUsageLoading(true);
            setError(null);
            
            let url = '/api/knowledge-base/usage-stats';
            const params = new URLSearchParams();
            
            if (usageFilter === 'username' && selectedUsername) {
                params.append('username', selectedUsername);
            } else if (usageFilter === 'template' && selectedTemplateForUsage) {
                params.append('template_id', selectedTemplateForUsage);
            }
            
            if (params.toString()) {
                url += '?' + params.toString();
            }
            
            const response = await API.get(url);
            if (response.data && response.data.success) {
                setUsageStats(response.data.stats);
            } else {
                setError(response.data?.error || 'Failed to fetch usage stats');
            }
        } catch (error) {
            console.error('Error fetching usage stats:', error);
            setError('Failed to load usage statistics. Please try again.');
        } finally {
            setUsageLoading(false);
        }
    };

    // Get unique usernames and templates for filters
    const getUniqueUsernames = () => {
        if (!usageStats?.usage_records) return [];
        const usernames = new Set();
        usageStats.usage_records.forEach(record => {
            if (record.username) usernames.add(record.username);
        });
        return Array.from(usernames).sort();
    };

    const getUniqueTemplates = () => {
        if (!usageStats?.usage_records) return [];
        const templateMap = new Map();
        usageStats.usage_records.forEach(record => {
            if (record.template_id && record.template_title) {
                templateMap.set(record.template_id, record.template_title);
            }
        });
        return Array.from(templateMap.entries()).map(([id, title]) => ({ id, title }));
    };

    // Filter usage records
    const filteredUsageRecords = () => {
        if (!usageStats?.usage_records) return [];
        
        let filtered = usageStats.usage_records;
        
        // Apply search filter
        if (usageSearchTerm) {
            const searchLower = usageSearchTerm.toLowerCase();
            filtered = filtered.filter(record => 
                record.template_title?.toLowerCase().includes(searchLower) ||
                record.username?.toLowerCase().includes(searchLower) ||
                record.template_id?.toLowerCase().includes(searchLower)
            );
        }
        
        return filtered;
    };

    // Calculate statistics
    const calculateUsageStats = () => {
        if (!usageStats?.usage_records) {
            return {
                totalUsage: 0,
                uniqueUsers: 0,
                uniqueTemplates: 0,
                mostUsedTemplate: null,
                mostActiveUser: null
            };
        }
        
        const records = usageStats.usage_records;
        const uniqueUsers = new Set(records.map(r => r.username)).size;
        const uniqueTemplates = new Set(records.map(r => r.template_id)).size;
        
        // Most used template
        const templateCounts = {};
        records.forEach(r => {
            if (r.template_id) {
                templateCounts[r.template_id] = (templateCounts[r.template_id] || 0) + 1;
            }
        });
        const mostUsedTemplateId = Object.keys(templateCounts).reduce((a, b) => 
            templateCounts[a] > templateCounts[b] ? a : b, null
        );
        const mostUsedTemplate = mostUsedTemplateId ? records.find(r => r.template_id === mostUsedTemplateId) : null;
        
        // Most active user
        const userCounts = {};
        records.forEach(r => {
            if (r.username) {
                userCounts[r.username] = (userCounts[r.username] || 0) + 1;
            }
        });
        const mostActiveUsername = Object.keys(userCounts).reduce((a, b) => 
            userCounts[a] > userCounts[b] ? a : b, null
        );
        
        return {
            totalUsage: records.length,
            uniqueUsers,
            uniqueTemplates,
            mostUsedTemplate: mostUsedTemplate ? {
                id: mostUsedTemplate.template_id,
                title: mostUsedTemplate.template_title,
                count: templateCounts[mostUsedTemplateId]
            } : null,
            mostActiveUser: mostActiveUsername ? {
                username: mostActiveUsername,
                count: userCounts[mostActiveUsername]
            } : null
        };
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <div className="card shadow-sm">
                        <div className="card-header bg-white border-bottom">
                            <div className="row align-items-center">
                                <div className="col-md-6">
                                    <h4 className="mb-0 text-dark">Knowledge Base</h4>
                                    <p className="text-muted mb-0">Remediation templates and security guidance</p>
                                </div>
                                <div className="col-md-6 text-end">
                                    <button 
                                        className="btn btn-primary"
                                        onClick={() => {
                                            setShowAddModal(true);
                                            setError(null);
                                            setSuccess(null);
                                        }}
                                    >
                                        Add New Template
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="card-body">
                            {/* Tab Navigation */}
                            <ul className="nav nav-tabs mb-4" role="tablist">
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={`nav-link ${mainTab === 'templates' ? 'active' : ''}`}
                                        onClick={() => setMainTab('templates')}
                                        type="button"
                                    >
                                        <i className="bi bi-file-text me-2"></i>
                                        Templates
                                    </button>
                                </li>
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={`nav-link ${mainTab === 'usage' ? 'active' : ''}`}
                                        onClick={() => setMainTab('usage')}
                                        type="button"
                                    >
                                        <i className="bi bi-bar-chart me-2"></i>
                                        Usage Tracking
                                    </button>
                                </li>
                            </ul>

                            {/* Success Message */}
                            {success && (
                                <div className="alert alert-success-subtle border-success-subtle text-success-emphasis mb-3" role="alert">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div className="d-flex align-items-center">
                                            <i className="bi bi-check-circle-fill me-2"></i>
                                            <span>{success}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            className="btn-close" 
                                            onClick={() => setSuccess(null)}
                                            aria-label="Close"
                                        ></button>
                                    </div>
                                </div>
                            )}
                            
                            {/* Error Message */}
                            {error && (
                                <div className="alert alert-danger-subtle border-danger-subtle text-danger-emphasis mb-3" role="alert">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div className="d-flex align-items-center">
                                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                            <span>{error}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            className="btn-close" 
                                            onClick={() => setError(null)}
                                            aria-label="Close"
                                        ></button>
                                    </div>
                                </div>
                            )}

                            {/* Templates Tab Content */}
                            {mainTab === 'templates' && (
                                <>
                            {/* Search and Filter */}
                            <div className="row mb-4">
                                <div className="col-md-6">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search templates..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="col-md-3">
                                    <select
                                        className="form-select"
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                    >
                                        <option value="all">All Categories</option>
                                        <option value="application">Application</option>
                                        <option value="infrastructure">Infrastructure</option>
                                        <option value="security">Security</option>
                                        <option value="network">Network</option>
                                        <option value="database">Database</option>
                                        <option value="data-analysis">Data Analysis</option>
                                        <option value="migration">Migration</option>
                                    </select>
                                </div>
                                <div className="col-md-3">
                                    <select
                                        className="form-select"
                                        value={activeTab}
                                        onChange={(e) => setActiveTab(e.target.value)}
                                    >
                                        <option value="all">All Templates</option>
                                        <option value="application">Application</option>
                                        <option value="infrastructure">Infrastructure</option>
                                        <option value="security">Security</option>
                                        <option value="network">Network</option>
                                        <option value="database">Database</option>
                                        <option value="data-analysis">Data Analysis</option>
                                        <option value="migration">Migration</option>
                                    </select>
                                </div>
                            </div>

                            {/* Templates List */}
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="mt-2 text-muted">Loading templates...</p>
                                </div>
                            ) : error ? (
                                <div className="alert alert-danger-subtle border-danger-subtle text-danger-emphasis" role="alert">
                                    <div className="d-flex align-items-center">
                                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                        <div>
                                            <strong>Error loading templates:</strong>
                                            <div className="mt-1">{error}</div>
                                            <button 
                                                className="btn btn-sm btn-outline-danger mt-2"
                                                onClick={fetchTemplates}
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : filteredTemplates.length === 0 ? (
                                <div className="text-center py-5">
                                    <p className="text-muted">No templates found</p>
                                </div>
                            ) : (
                                <div className="row">
                                    {filteredTemplates.map((template) => (
                                        <div key={template.id} className="col-md-6 col-lg-4 mb-4">
                                            <div className="card h-100 border-0 shadow-sm">
                                                <div className="card-header bg-light border-bottom">
                                                    <div className="d-flex justify-content-between align-items-start">
                                                        <div>
                                                            <h6 className="mb-1 text-dark">{template.title}</h6>
                                                            <span 
                                                                className="badge"
                                                                style={{ 
                                                                    backgroundColor: getCategoryColor(template.category),
                                                                    color: 'white'
                                                                }}
                                                            >
                                                                {template.category}
                                                            </span>
                                                        </div>
                                                    </div>
                        </div>
                        <div className="card-body">
                                                    <p className="card-text text-muted small">
                                                        {template.description.length > 100 
                                                            ? template.description.substring(0, 100) + '...'
                                                            : template.description
                                                        }
                                                    </p>
                                                    <div className="mb-2">
                                                        <small className="text-muted">
                                                            Created: {formatDate(template.created_at)}
                                                        </small>
                                                    </div>
                                                    <div className="mb-2">
                                                        <small className="text-muted">
                                                            Type: {
                                                                template.content_type === 'url' ? 'Web Content' :
                                                                template.content_type === 'excel' ? 'Excel Data Analysis' :
                                                                'File Upload'
                                                            }
                                                        </small>
                                                    </div>
                                                    {template.content_type === 'excel' && template.metadata && (
                                                        <div className="mb-2">
                                                            <small className="text-info">
                                                                Rows: {template.metadata.excel_rows || 'N/A'} | 
                                                                Tickets: {template.metadata.jira_tickets || 'N/A'}
                                                            </small>
                                                        </div>
                                                    )}
                                                    {template.ai_copilot_prompt && (
                                                        <div className="mb-2">
                                                            <small className="text-success">
                                                                {template.content_type === 'excel' ? 'Root Cause Explorer Ready' : 'AI Copilot Ready'}
                                                            </small>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="card-footer bg-white border-top">
                                                    <div className="btn-group w-100" role="group">
                                                        <button 
                                                            className="btn btn-outline-primary btn-sm"
                                                            onClick={() => handleViewTemplate(template)}
                                                        >
                                                            View
                                                        </button>
                                                        {template.content_type === 'excel' ? (
                                                            <button 
                                                                className="btn btn-outline-info btn-sm"
                                                                onClick={() => handleViewTemplate(template)}
                                                                title="Root Cause Analysis"
                                                            >
                                                                Analyze
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                className="btn btn-outline-success btn-sm"
                                                                onClick={() => handleDownloadTemplate(template.id, template.title)}
                                                            >
                                                                Download MD
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            </>
                            )}

                            {/* Usage Tracking Tab Content */}
                            {mainTab === 'usage' && (
                                <>
                                    {/* Usage Statistics Cards */}
                                    {(() => {
                                        const stats = calculateUsageStats();
                                        return (
                                            <div className="row mb-4">
                                                <div className="col-md-3">
                                                    <div className="card bg-primary text-white">
                                                        <div className="card-body">
                                                            <h5 className="card-title">Total Usage</h5>
                                                            <h2>{stats.totalUsage}</h2>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="card bg-success text-white">
                                                        <div className="card-body">
                                                            <h5 className="card-title">Active Users</h5>
                                                            <h2>{stats.uniqueUsers}</h2>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="card bg-info text-white">
                                                        <div className="card-body">
                                                            <h5 className="card-title">Templates Used</h5>
                                                            <h2>{stats.uniqueTemplates}</h2>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="card bg-warning text-white">
                                                        <div className="card-body">
                                                            <h5 className="card-title">Most Active User</h5>
                                                            <h6>{stats.mostActiveUser?.username || 'N/A'}</h6>
                                                            <small>{stats.mostActiveUser?.count || 0} uses</small>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Usage Filters */}
                                    <div className="row mb-4">
                                        <div className="col-md-4">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Search by template name, username, or ID..."
                                                value={usageSearchTerm}
                                                onChange={(e) => setUsageSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="col-md-3">
                                            <select
                                                className="form-select"
                                                value={usageFilter}
                                                onChange={(e) => setUsageFilter(e.target.value)}
                                            >
                                                <option value="all">All Usage</option>
                                                <option value="username">Filter by User</option>
                                                <option value="template">Filter by Template</option>
                                            </select>
                                        </div>
                                        {usageFilter === 'username' && (
                                            <div className="col-md-3">
                                                <select
                                                    className="form-select"
                                                    value={selectedUsername}
                                                    onChange={(e) => setSelectedUsername(e.target.value)}
                                                >
                                                    <option value="">Select User...</option>
                                                    {getUniqueUsernames().map(username => (
                                                        <option key={username} value={username}>{username}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {usageFilter === 'template' && (
                                            <div className="col-md-3">
                                                <select
                                                    className="form-select"
                                                    value={selectedTemplateForUsage}
                                                    onChange={(e) => setSelectedTemplateForUsage(e.target.value)}
                                                >
                                                    <option value="">Select Template...</option>
                                                    {getUniqueTemplates().map(template => (
                                                        <option key={template.id} value={template.id}>{template.title}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="col-md-2">
                                            <button
                                                className="btn btn-outline-primary w-100"
                                                onClick={fetchUsageStats}
                                                disabled={usageLoading}
                                            >
                                                {usageLoading ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                        Loading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="bi bi-arrow-clockwise me-2"></i>
                                                        Refresh
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Most Used Templates */}
                                    {(() => {
                                        const stats = calculateUsageStats();
                                        if (stats.mostUsedTemplate) {
                                            return (
                                                <div className="alert alert-info mb-4">
                                                    <strong>Most Used Template:</strong> {stats.mostUsedTemplate.title} ({stats.mostUsedTemplate.count} uses)
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Usage Records Table */}
                                    {usageLoading ? (
                                        <div className="text-center py-5">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                            <p className="mt-2 text-muted">Loading usage statistics...</p>
                                        </div>
                                    ) : filteredUsageRecords().length === 0 ? (
                                        <div className="text-center py-5">
                                            <i className="bi bi-bar-chart" style={{ fontSize: '3rem', color: '#ccc' }}></i>
                                            <p className="text-muted mt-2">No usage records found</p>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover">
                                                <thead>
                                                    <tr>
                                                        <th>Timestamp</th>
                                                        <th>Username</th>
                                                        <th>Template Title</th>
                                                        <th>Usage Type</th>
                                                        <th>Source</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredUsageRecords().map((record, index) => (
                                                        <tr key={record.id || index}>
                                                            <td>{formatDate(record.timestamp)}</td>
                                                            <td>
                                                                <span className="badge bg-primary">
                                                                    <i className="bi bi-person me-1"></i>
                                                                    {record.username || 'Unknown'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <strong>{record.template_title || 'N/A'}</strong>
                                                            </td>
                                                            <td>
                                                                <span className={`badge bg-${
                                                                    record.usage_type === 'used' ? 'success' :
                                                                    record.usage_type === 'viewed' ? 'info' :
                                                                    'secondary'
                                                                }`}>
                                                                    {record.usage_type || 'used'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="badge bg-secondary">
                                                                    {record.source === 'vscode_extension' ? (
                                                                        <>
                                                                            <i className="bi bi-code-square me-1"></i>
                                                                            VSCode
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <i className="bi bi-browser-chrome me-1"></i>
                                                                            Web App
                                                                        </>
                                                                    )}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Template Modal */}
            {showAddModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Add New Template</h5>
                                <button 
                                    type="button" 
                                    className="btn-close"
                                    onClick={() => setShowAddModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <label className="form-label">Template Title</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={newTemplate.title}
                                        onChange={(e) => setNewTemplate({...newTemplate, title: e.target.value})}
                                        placeholder="Enter template title"
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Description</label>
                                    <textarea
                                        className="form-control"
                                        rows="3"
                                        value={newTemplate.description}
                                        onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                                        placeholder="Enter template description"
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Category</label>
                                    <select
                                        className="form-select"
                                        value={newTemplate.category}
                                        onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                                    >
                                        <option value="application">Application</option>
                                        <option value="infrastructure">Infrastructure</option>
                                        <option value="security">Security</option>
                                        <option value="network">Network</option>
                                        <option value="database">Database</option>
                                        <option value="data-analysis">Data Analysis</option>
                                        <option value="migration">Migration</option>
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Content Source</label>
                                    <select
                                        className="form-select"
                                        value={newTemplate.content_type}
                                        onChange={(e) => setNewTemplate({...newTemplate, content_type: e.target.value})}
                                    >
                                        <option value="url">Web Page URL</option>
                                        <option value="file">File Upload</option>
                                    </select>
                                </div>
                                {newTemplate.content_type === 'url' ? (
                                    <div className="mb-3">
                                        <label className="form-label">Web Page URL</label>
                                        <input
                                            type="url"
                                            className="form-control"
                                            value={newTemplate.content}
                                            onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                                            placeholder="https://example.com/security-issue"
                                        />
                                    </div>
                                ) : (
                                    <div className="mb-3">
                                        <label className="form-label">Upload File</label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            onChange={(e) => setNewTemplate({...newTemplate, file: e.target.files[0]})}
                                            accept=".txt,.md,.pdf,.doc,.docx,.xlsx,.xls"
                                        />
                                        <div className="form-text">
                                            <strong>For Jira Data Analysis:</strong> Upload Excel files with columns: Jira ID, Jira Title, Jira Comments
                                        </div>
                                        <div className="form-text">
                                            <strong>Supported formats:</strong> .xlsx, .xls, .txt, .md, .pdf, .doc, .docx
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary"
                                    onClick={() => setShowAddModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    onClick={handleAddTemplate}
                                >
                                    Add Template
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Template Modal */}
            {showViewModal && selectedTemplate && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{selectedTemplate.title}</h5>
                                <button 
                                    type="button" 
                                    className="btn-close"
                                    onClick={() => setShowViewModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <strong>Category:</strong> 
                                        <span 
                                            className="badge ms-2"
                                            style={{ 
                                                backgroundColor: getCategoryColor(selectedTemplate.category),
                                                color: 'white'
                                            }}
                                        >
                                            {selectedTemplate.category}
                                        </span>
                                    </div>
                                    <div className="col-md-6">
                                        <strong>Created:</strong> {formatDate(selectedTemplate.created_at)}
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <strong>Description:</strong>
                                    <p className="mt-1">{selectedTemplate.description}</p>
                                </div>
                                {selectedTemplate.ai_copilot_prompt && (
                                    <div className="mb-3">
                                        <strong>AI Copilot Prompt:</strong>
                                        <pre className="bg-light p-3 rounded mt-2" style={{ fontSize: '0.9rem' }}>
                                            {selectedTemplate.ai_copilot_prompt}
                                        </pre>
                                    </div>
                                )}
                                {selectedTemplate.remediation_template && (
                                    <div className="mb-3">
                                        <strong>Remediation Template:</strong>
                                        <pre className="bg-light p-3 rounded mt-2" style={{ fontSize: '0.9rem' }}>
                                            {selectedTemplate.remediation_template}
                                        </pre>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary"
                                    onClick={() => setShowViewModal(false)}
                                >
                                    Close
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    onClick={() => {
                                        navigator.clipboard.writeText(selectedTemplate.ai_copilot_prompt || selectedTemplate.remediation_template);
                                        alert('Template copied to clipboard!');
                                    }}
                                >
                                    Copy to Clipboard
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-success"
                                    onClick={() => handleDownloadTemplate(selectedTemplate.id, selectedTemplate.title)}
                                >
                                    Download Markdown
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;
