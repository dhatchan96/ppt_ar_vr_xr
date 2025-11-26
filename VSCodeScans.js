import React, { useEffect, useState } from "react";
import API from "../api";
import "../style.css";
import { FaCode, FaEye, FaDownload, FaTrash, FaSync, FaFilter, FaSearch } from "react-icons/fa";

const VSCodeScans = () => {
  const [vscodeScans, setVscodeScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedScan, setSelectedScan] = useState(null);
  const [showScanDetails, setShowScanDetails] = useState(false);

  useEffect(() => {
    fetchVSCodeScans();
  }, []);

  // Debug: Log when vscodeScans changes
  useEffect(() => {
    console.log("🔍 React - vscodeScans state changed:", {
      count: vscodeScans.length,
      sample: vscodeScans.slice(0, 2).map(s => ({
        scan_id: s.scan_id,
        source: s.source,
        issues_found: s.issues_found,
        total_threats: s.total_threats
      }))
    });
  }, [vscodeScans]);

  const fetchVSCodeScans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch scan history and filter for VSCode scans
      const response = await API.get("/api/scan-history");
      const allScans = response.data.scan_history || [];
      
      console.log("🔍 React - Total scans received:", allScans.length);
      console.log("🔍 React - Sample scan sources:", allScans.slice(0, 3).map(s => s.source));
      
      // Filter for VSCode scans (those with vscode-related metadata or source)
      // Filter for VSCode scans - prioritize source field first
      const vscodeScansData = allScans.filter(scan => {
        // First check if source is explicitly vscode_extension
        if (scan.source === 'vscode_extension') {
          console.log(`🔍 React - VSCode scan found (by source): ${scan.scan_id}, source: ${scan.source}, file_name: ${scan.file_name}`);
          return true;
        }
        
        // Fallback checks for scans that might be VSCode but have wrong source
        const isVSCodeScan = scan.project_id?.includes('vscode') ||
                           scan.project_name?.includes('VSCode') ||
                           scan.file_name === 'workspace_scan' ||
                           scan.file_name?.includes('high_risk_test.py');
        
        if (isVSCodeScan) {
          console.log(`🔍 React - VSCode scan found (by fallback): ${scan.scan_id}, source: ${scan.source}, file_name: ${scan.file_name}`);
        }
        return isVSCodeScan;
      });
      
      console.log("🔍 React - VSCode scans found:", vscodeScansData.length);
      
      // Deduplicate scans by scan_id, keeping the one with vscode_extension source or most complete data
      const uniqueScans = [];
      const seenScanIds = new Set();
      
      vscodeScansData.forEach(scan => {
        if (!seenScanIds.has(scan.scan_id)) {
          seenScanIds.add(scan.scan_id);
          uniqueScans.push(scan);
        } else {
          // If we've seen this scan_id before, replace it only if the new one has better data
          const existingIndex = uniqueScans.findIndex(s => s.scan_id === scan.scan_id);
          const existing = uniqueScans[existingIndex];
          
          // Prefer vscode_extension source over main_scan
          if (scan.source === 'vscode_extension' && existing.source !== 'vscode_extension') {
            uniqueScans[existingIndex] = scan;
            console.log(`🔍 React - Replaced scan ${scan.scan_id} with vscode_extension version`);
          }
          // Prefer scan with more complete data
          else if (scan.issues_found && !existing.issues_found) {
            uniqueScans[existingIndex] = scan;
            console.log(`🔍 React - Replaced scan ${scan.scan_id} with more complete data`);
          }
        }
      });
      
      console.log("🔍 React - After deduplication:", uniqueScans.length, "unique scans");
      if (uniqueScans.length > 0) {
        const latestScan = uniqueScans[0];
        console.log("🔍 React - Latest VSCode scan:", {
          scan_id: latestScan.scan_id,
          source: latestScan.source,
          issues_found: latestScan.issues_found,
          total_threats: latestScan.total_threats,
          issues_length: latestScan.issues?.length,
          quality_gate: latestScan.quality_gate_status,
          threat_shield: latestScan.threat_shield_status
        });
      }
      
      setVscodeScans(uniqueScans);
    } catch (err) {
      console.error("Failed to fetch VSCode scans:", err);
      setError("Failed to load VSCode scan data");
    } finally {
      setLoading(false);
    }
  };

  const handleScanDetails = (scan) => {
    console.log("🔍 React - Opening scan details for:", {
      scan_id: scan.scan_id,
      issues_found: scan.issues_found,
      total_threats: scan.total_threats,
      issues_length: scan.issues?.length,
      lines_of_code: scan.lines_of_code,
      coverage: scan.coverage,
      quality_gate: scan.quality_gate_status,
      threat_shield: scan.threat_shield_status
    });
    setSelectedScan(scan);
    setShowScanDetails(true);
  };

  const closeScanDetails = () => {
    setShowScanDetails(false);
    setSelectedScan(null);
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL_BOMB':
      case 'CRITICAL':
        return 'danger';
      case 'HIGH_RISK':
      case 'HIGH':
        return 'warning';
      case 'MEDIUM_RISK':
      case 'MEDIUM':
        return 'info';
      case 'LOW_RISK':
      case 'LOW':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'BLOCKED': 'danger',
      'PASSED': 'success',
      'WARNING': 'warning',
      'FAILED': 'danger'
    };
    return statusColors[status] || 'secondary';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (durationMs) => {
    if (!durationMs) return 'N/A';
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const filteredScans = vscodeScans.filter(scan => {
    // Debug: Log the scan data being filtered
    console.log(`🔍 React - Filtering scan ${scan.scan_id}:`, {
      source: scan.source,
      file_name: scan.file_name,
      issues_found: scan.issues_found,
      total_threats: scan.total_threats,
      issues_length: scan.issues?.length
    });
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        scan.project_id?.toLowerCase().includes(searchLower) ||
        scan.file_name?.toLowerCase().includes(searchLower) ||
        scan.file_path?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply status filter
    const status = scan.quality_gate_status || scan.threat_shield_status;
    if (filter === "blocked" && status !== "BLOCKED") return false;
    if (filter === "passed" && status !== "PASSED") return false;
    if (filter === "with-threats" && (!scan.issues || scan.issues.length === 0) && (!scan.total_threats || scan.total_threats === 0) && (!scan.issues_found || scan.issues_found === 0)) return false;
    
    return true;
  });

  const totalPages = Math.ceil(filteredScans.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentScans = filteredScans.slice(startIndex, endIndex);

  const getPaginationWindow = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (current + delta < total - 1) {
      rangeWithDots.push('...', total);
    } else {
      rangeWithDots.push(total);
    }

    return rangeWithDots;
  };

  if (loading) {
    return (
      <div className="container-fluid mt-4">
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading VSCode scan data...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid mt-4">
        <div className="row">
          <div className="col-12">
            <div className="alert alert-danger" role="alert">
              <strong>Error:</strong> {error}
              <button className="btn btn-outline-danger ms-3" onClick={fetchVSCodeScans}>
                <FaRefresh /> Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="card-title mb-0">
                    <FaCode className="me-2" />
                    VSCode Extension Scans
                  </h4>
                  <p className="text-muted mb-0">
                    View and manage security scans performed through the VSCode extension
                  </p>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary" onClick={fetchVSCodeScans}>
                    <FaSync /> Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="input-group">
                    <span className="input-group-text">
                      <FaSearch />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search scans by project ID, file name, or path..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <select
                    className="form-select"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All Scans</option>
                    <option value="blocked">Blocked</option>
                    <option value="passed">Passed</option>
                    <option value="with-threats">With Threats</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <select
                    className="form-select"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Statistics */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white">
            <div className="card-body">
              <h5 className="card-title">Total Scans</h5>
              <h3>{vscodeScans.length}</h3>
            </div>
          </div>
        </div>
                 <div className="col-md-3">
           <div className="card bg-danger text-white">
             <div className="card-body">
               <h5 className="card-title">Blocked Scans</h5>
               <h3>{vscodeScans.filter(s => s.quality_gate_status === 'BLOCKED' || s.threat_shield_status === 'BLOCKED').length}</h3>
             </div>
           </div>
         </div>
         <div className="col-md-3">
           <div className="card bg-success text-white">
             <div className="card-body">
               <h5 className="card-title">Passed Scans</h5>
               <h3>{vscodeScans.filter(s => s.quality_gate_status === 'PASSED' || s.threat_shield_status === 'PASSED').length}</h3>
             </div>
           </div>
         </div>
         <div className="col-md-3">
           <div className="card bg-warning text-white">
             <div className="card-body">
               <h5 className="card-title">Total Threats</h5>
               <h3>{(() => {
                 const totalThreats = vscodeScans.reduce((sum, scan) => {
                   const threats = scan.issues?.length || scan.total_threats || scan.issues_found || 0;
                   console.log(`🔍 React - Scan ${scan.scan_id}: threats=${threats} (issues.length=${scan.issues?.length}, total_threats=${scan.total_threats}, issues_found=${scan.issues_found})`);
                   return sum + threats;
                 }, 0);
                 console.log(`🔍 React - Total threats calculated: ${totalThreats}`);
                 return totalThreats;
               })()}</h3>
             </div>
           </div>
         </div>
      </div>

      {/* Scans Table */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">VSCode Scan History</h5>
            </div>
            <div className="card-body">
              {currentScans.length === 0 ? (
                <div className="text-center py-4">
                  <FaCode className="text-muted" style={{ fontSize: '3rem' }} />
                  <p className="text-muted mt-2">No VSCode scans found</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Scan ID</th>
                        <th>Project/File</th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Threats</th>
                        <th>Duration</th>
                        <th>Timestamp</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentScans.map((scan) => (
                        <tr key={scan.scan_id}>
                          <td>
                            <code className="text-primary">{scan.scan_id?.substring(0, 8)}...</code>
                          </td>
                          <td>
                            <div>
                              <strong>{scan.file_name || scan.project_id}</strong>
                              {scan.file_path && (
                                <div className="text-muted small">{scan.file_path}</div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <i className="fas fa-user me-2 text-primary"></i>
                              <span className="fw-bold">{scan.username || 'Unknown'}</span>
                            </div>
                          </td>
                                                     <td>
                             <span className={`badge bg-${getStatusBadge(scan.quality_gate_status || scan.threat_shield_status)}`}>
                               {scan.quality_gate_status || scan.threat_shield_status || 'UNKNOWN'}
                             </span>
                           </td>
                           <td>
                             <span className={`badge bg-${(scan.issues?.length || scan.total_threats || scan.issues_found || 0) > 0 ? 'danger' : 'success'}`}>
                               {(() => {
                                 const threats = scan.issues?.length || scan.total_threats || scan.issues_found || 0;
                                 console.log(`🔍 React - Table row ${scan.scan_id}: threats=${threats} (issues.length=${scan.issues?.length}, total_threats=${scan.total_threats}, issues_found=${scan.issues_found})`);
                                 return `${threats} threats`;
                               })()}
                             </span>
                           </td>
                          <td>{formatDuration(scan.duration_ms)}</td>
                          <td>{formatDate(scan.timestamp)}</td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-primary"
                                onClick={() => handleScanDetails(scan)}
                                title="View Details"
                              >
                                <FaEye />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav aria-label="Scan pagination">
                  <ul className="pagination justify-content-center">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                    </li>
                    
                    {getPaginationWindow(currentPage, totalPages).map((page, index) => (
                      <li key={index} className={`page-item ${page === '...' ? 'disabled' : ''} ${page === currentPage ? 'active' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => typeof page === 'number' && setCurrentPage(page)}
                          disabled={page === '...'}
                        >
                          {page}
                        </button>
                      </li>
                    ))}
                    
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scan Details Modal */}
      {showScanDetails && selectedScan && (
        <div className="modal fade show vscode-scans-modal" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-xl" style={{ zIndex: 1055 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FaCode className="me-2" />
                  Scan Details
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeScanDetails}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6>Scan Information</h6>
                    <table className="table table-sm">
                      <tbody>
                        <tr>
                          <td><strong>Scan ID:</strong></td>
                          <td><code>{selectedScan.scan_id}</code></td>
                        </tr>
                        <tr>
                          <td><strong>Project ID:</strong></td>
                          <td>{selectedScan.project_id}</td>
                        </tr>
                        <tr>
                          <td><strong>File Name:</strong></td>
                          <td>{selectedScan.file_name || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td><strong>File Path:</strong></td>
                          <td>{selectedScan.file_path || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td><strong>Username:</strong></td>
                          <td>
                            <div className="d-flex align-items-center">
                              <i className="fas fa-user me-2 text-primary"></i>
                              <span className="fw-bold">{selectedScan.username || 'Unknown'}</span>
                            </div>
                          </td>
                        </tr>
                                                 <tr>
                           <td><strong>Status:</strong></td>
                           <td>
                             <span className={`badge bg-${getStatusBadge(selectedScan.quality_gate_status || selectedScan.threat_shield_status)}`}>
                               {selectedScan.quality_gate_status || selectedScan.threat_shield_status}
                             </span>
                           </td>
                         </tr>
                        <tr>
                          <td><strong>Duration:</strong></td>
                          <td>{formatDuration(selectedScan.duration_ms)}</td>
                        </tr>
                        <tr>
                          <td><strong>Timestamp:</strong></td>
                          <td>{formatDate(selectedScan.timestamp)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="col-md-6">
                    <h6>Scan Metrics</h6>
                    <table className="table table-sm">
                      <tbody>
                                                 <tr>
                           <td><strong>Files Scanned:</strong></td>
                           <td>{selectedScan.files_scanned || 'N/A'}</td>
                         </tr>
                         <tr>
                           <td><strong>Issues Found:</strong></td>
                           <td>{(() => {
                             const issuesFound = selectedScan.issues?.length || selectedScan.issues_found || selectedScan.total_threats || 0;
                             console.log("🔍 React - Modal Issues Found:", {
                               issues_length: selectedScan.issues?.length,
                               issues_found: selectedScan.issues_found,
                               total_threats: selectedScan.total_threats,
                               calculated: issuesFound
                             });
                             return issuesFound;
                           })()}</td>
                         </tr>
                         <tr>
                           <td><strong>Lines of Code:</strong></td>
                           <td>{(() => {
                             console.log("🔍 React - Modal Lines of Code:", selectedScan.lines_of_code);
                             return selectedScan.lines_of_code || 'N/A';
                           })()}</td>
                         </tr>
                         <tr>
                           <td><strong>Coverage:</strong></td>
                           <td>{(() => {
                             console.log("🔍 React - Modal Coverage:", selectedScan.coverage);
                             return selectedScan.coverage || 'N/A';
                           })()}</td>
                         </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Threats List */}
                {selectedScan.issues && selectedScan.issues.length > 0 && (
                  <div className="mt-4">
                    <h6>Detected Threats</h6>
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Severity</th>
                            <th>File</th>
                            <th>Line</th>
                            <th>Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedScan.issues.map((issue, index) => (
                            <tr key={index}>
                              <td>
                                <span className="badge bg-secondary">{issue.type}</span>
                              </td>
                              <td>
                                <span className={`badge bg-${getSeverityColor(issue.severity)}`}>
                                  {issue.severity}
                                </span>
                              </td>
                              <td>{issue.file_name || 'N/A'}</td>
                              <td>{issue.line_number || 'N/A'}</td>
                              <td>
                                <div className="message-content" style={{ 
                                  maxWidth: '400px', 
                                  wordWrap: 'break-word', 
                                  whiteSpace: 'normal',
                                  lineHeight: '1.4'
                                }} title={issue.message}>
                                  {issue.message}
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
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeScanDetails}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Backdrop */}
      {showScanDetails && (
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
      )}
    </div>
  );
};

export default VSCodeScans;
