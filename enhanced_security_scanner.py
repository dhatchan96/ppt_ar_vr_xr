#!/usr/bin/env python3
"""
Enhanced Security Scanner with Copilot Integration
Main scanner enhanced with AI-powered suggestions and automated fixes
"""

import os
import sys
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import hashlib
import threading
import time

# Import base components
from security_scanner_main import SecurityScanner, SecurityIssue, ScanResult, SecurityRule
from copilot_suggestion_engine import CopilotSuggestionEngine, CopilotSuggestion

class EnhancedSecurityScanner(SecurityScanner):
    """Enhanced Security Scanner with Copilot AI integration"""
    
    def __init__(self, data_dir: str = "enhanced_scanner_data"):
        super().__init__(data_dir)
        
        # Initialize Copilot engine
        self.copilot_engine = CopilotSuggestionEngine(
            cache_dir=str(self.data_dir / "copilot_cache")
        )
        
        # Enhanced tracking
        self.suggestion_history = []
        self.fix_application_history = []
        
        print("🤖 Enhanced Security Scanner with Copilot Integration")
        print(f"   • Copilot available: {self.copilot_engine.copilot_available}")
        print(f"   • Enhanced features: AI suggestions, automated fixes, context-aware recommendations")
    
    def scan_project_with_copilot(self, project_path: str, project_id: str, 
                                 generate_suggestions: bool = True) -> Dict[str, Any]:
        """Enhanced project scan with Copilot integration"""
        
        print(f"🔍 Starting enhanced scan for project: {project_id}")
        start_time = datetime.now()
        
        # Perform base scan
        scan_result = self.scan_project(project_path, project_id)
        
        enhanced_result = {
            'base_scan': asdict(scan_result),
            'copilot_integration': {
                'suggestions_generated': 0,
                'automated_fixes_available': 0,
                'high_confidence_suggestions': 0,
                'suggestion_sources': {'github_copilot': 0, 'template': 0},
                'security_contexts_found': 0
            },
            'enhanced_issues': [],
            'project_recommendations': [],
            'remediation_plan': {}
        }
        
        if generate_suggestions and scan_result.issues:
            print(f"🤖 Generating Copilot suggestions for {len(scan_result.issues)} issues...")
            
            # Generate suggestions for all issues
            copilot_suggestions = self.copilot_engine.bulk_generate_suggestions(scan_result.issues)
            
            # Enhance issues with suggestions
            enhanced_issues = []
            for issue in scan_result.issues:
                enhanced_issue = self._enhance_issue_with_suggestion(issue, copilot_suggestions.get(issue.id))
                enhanced_issues.append(enhanced_issue)
                
                # Update integration stats
                if enhanced_issue.get('copilot_suggestion'):
                    enhanced_result['copilot_integration']['suggestions_generated'] += 1
                    
                    suggestion = enhanced_issue['copilot_suggestion']
                    if suggestion.get('automated_fix_available'):
                        enhanced_result['copilot_integration']['automated_fixes_available'] += 1
                    
                    if suggestion.get('confidence') == 'high':
                        enhanced_result['copilot_integration']['high_confidence_suggestions'] += 1
                    
                    source = suggestion.get('source', 'template')
                    enhanced_result['copilot_integration']['suggestion_sources'][source] += 1
            
            enhanced_result['enhanced_issues'] = enhanced_issues
            
            # Generate project-level recommendations
            enhanced_result['project_recommendations'] = self._generate_project_recommendations(
                scan_result, copilot_suggestions
            )
            
            # Create remediation plan
            enhanced_result['remediation_plan'] = self._create_remediation_plan(
                enhanced_issues, copilot_suggestions
            )
        
        # Save enhanced scan result
        self._save_enhanced_scan_result(enhanced_result, project_id)
        
        duration = (datetime.now() - start_time).total_seconds()
        print(f"✅ Enhanced scan completed in {duration:.2f} seconds")
        print(f"   • Base issues: {len(scan_result.issues)}")
        print(f"   • Copilot suggestions: {enhanced_result['copilot_integration']['suggestions_generated']}")
        print(f"   • Automated fixes available: {enhanced_result['copilot_integration']['automated_fixes_available']}")
        
        return enhanced_result
    
    def _enhance_issue_with_suggestion(self, issue: SecurityIssue, 
                                     copilot_suggestion: Optional[CopilotSuggestion]) -> Dict[str, Any]:
        """Enhance issue with Copilot suggestion"""
        
        enhanced_issue = {
            'id': issue.id,
            'rule_id': issue.rule_id,
            'file_path': issue.file_path,
            'line_number': issue.line_number,
            'column': issue.column,
            'message': issue.message,
            'severity': issue.severity,
            'type': issue.type,
            'status': issue.status,
            'code_snippet': issue.code_snippet,
            'suggested_fix': issue.suggested_fix,
            'effort': issue.effort,
            'creation_date': issue.creation_date
        }
        
        if copilot_suggestion:
            enhanced_issue['copilot_suggestion'] = {
                'suggestion_text': copilot_suggestion.suggestion_text,
                'code_example': copilot_suggestion.code_example,
                'explanation': copilot_suggestion.explanation,
                'confidence': copilot_suggestion.confidence,
                'source': copilot_suggestion.source,
                'automated_fix_available': copilot_suggestion.automated_fix_available,
                'generated_at': copilot_suggestion.generated_at
            }
            
            # Add security context
            security_context = self.copilot_engine.get_security_context(issue.rule_id)
            if security_context:
                enhanced_issue['security_context'] = {
                    'threat_description': security_context.threat_description,
                    'impact_level': security_context.impact_level,
                    'compliance_standards': security_context.compliance_standards,
                    'recommended_tools': security_context.recommended_tools,
                    'prevention_tips': security_context.prevention_tips
                }
            
            # Add automated fix details
            if copilot_suggestion.automated_fix_available:
                code_snippet = self._get_issue_code_snippet(issue)
                fix_details = self.copilot_engine.generate_automated_fix(issue, code_snippet)
                enhanced_issue['automated_fix_details'] = fix_details
            
            # Calculate priority score
            enhanced_issue['priority_score'] = self._calculate_issue_priority(issue, security_context)
        
        return enhanced_issue
    
    def _get_issue_code_snippet(self, issue: SecurityIssue, context_lines: int = 3) -> str:
        """Get code snippet around the issue"""
        try:
            with open(issue.file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            start = max(0, issue.line_number - context_lines - 1)
            end = min(len(lines), issue.line_number + context_lines)
            
            return ''.join(lines[start:end])
        except Exception as e:
            return issue.code_snippet or ""
    
    def _calculate_issue_priority(self, issue: SecurityIssue, security_context) -> int:
        """Calculate priority score for an issue"""
        
        # Base score from severity
        severity_scores = {
            'BLOCKER': 100,
            'CRITICAL': 80,
            'MAJOR': 60,
            'MINOR': 40,
            'INFO': 20
        }
        
        score = severity_scores.get(issue.severity, 50)
        
        # Type adjustments
        if issue.type == 'VULNERABILITY':
            score += 10
        elif issue.type == 'SECURITY_HOTSPOT':
            score += 5
        
        # Security context adjustments
        if security_context:
            if security_context.compliance_standards:
                score += len(security_context.compliance_standards) * 2
            
            if security_context.impact_level == 'CRITICAL':
                score += 15
            elif security_context.impact_level == 'HIGH':
                score += 10
        
        # File importance adjustments
        important_files = ['auth', 'login', 'password', 'config', 'secret', 'key', 'token', 'admin']
        if any(keyword in issue.file_path.lower() for keyword in important_files):
            score += 10
        
        return min(100, max(1, score))
    
    def _generate_project_recommendations(self, scan_result: ScanResult, 
                                        copilot_suggestions: Dict[str, CopilotSuggestion]) -> List[str]:
        """Generate project-level recommendations"""
        
        recommendations = []
        
        # Issue count analysis
        total_issues = len(scan_result.issues)
        critical_issues = len([i for i in scan_result.issues if i.severity in ['BLOCKER', 'CRITICAL']])
        
        if critical_issues > 0:
            recommendations.append(f"🚨 **Critical Priority**: Address {critical_issues} critical security issues immediately")
        
        # Automation opportunities
        automated_fixes_available = sum(1 for s in copilot_suggestions.values() if s.automated_fix_available)
        if automated_fixes_available > 0:
            percentage = (automated_fixes_available / total_issues) * 100
            recommendations.append(f"🤖 **Automation Opportunity**: {automated_fixes_available} issues ({percentage:.1f}%) can be fixed automatically")
        
        # Security rating recommendations
        if scan_result.security_rating in ['D', 'E']:
            recommendations.append("🔒 **Security Rating**: Focus on vulnerability remediation to improve security rating")
        
        # Quality gate recommendations
        if scan_result.quality_gate_status != 'OK':
            recommendations.append("🚧 **Quality Gate**: Address quality gate conditions before deployment")
        
        # Coverage recommendations
        if scan_result.coverage < 70:
            recommendations.append(f"📊 **Test Coverage**: Increase test coverage from {scan_result.coverage:.1f}% to at least 70%")
        
        # File-specific recommendations
        file_groups = {}
        for issue in scan_result.issues:
            file_type = Path(issue.file_path).suffix or 'unknown'
            file_groups[file_type] = file_groups.get(file_type, 0) + 1
        
        if file_groups:
            top_file_type = max(file_groups.items(), key=lambda x: x[1])
            recommendations.append(f"📁 **Focus Area**: {top_file_type[1]} issues found in {top_file_type[0]} files")
        
        # Compliance recommendations
        compliance_standards = set()
        for suggestion in copilot_suggestions.values():
            security_context = self.copilot_engine.get_security_context(suggestion.issue_id)
            if security_context and security_context.compliance_standards:
                compliance_standards.update(security_context.compliance_standards)
        
        if compliance_standards:
            standards_str = ', '.join(list(compliance_standards)[:3])
            recommendations.append(f"📋 **Compliance**: Issues affect {standards_str} compliance requirements")
        
        return recommendations
    
    def _create_remediation_plan(self, enhanced_issues: List[Dict[str, Any]], 
                               copilot_suggestions: Dict[str, CopilotSuggestion]) -> Dict[str, Any]:
        """Create a comprehensive remediation plan"""
        
        # Group issues by priority and automation
        immediate_actions = []
        automated_fixes = []
        manual_fixes = []
        
        for issue in enhanced_issues:
            issue_data = {
                'issue_id': issue['id'],
                'rule_id': issue['rule_id'],
                'file_path': issue['file_path'],
                'line_number': issue['line_number'],
                'severity': issue['severity'],
                'priority_score': issue.get('priority_score', 50),
                'estimated_effort': issue.get('effort', 30)
            }
            
            # Categorize by priority
            if issue['severity'] in ['BLOCKER', 'CRITICAL']:
                immediate_actions.append(issue_data)
            elif issue.get('copilot_suggestion', {}).get('automated_fix_available'):
                automated_fixes.append(issue_data)
            else:
                manual_fixes.append(issue_data)
        
        # Sort by priority score
        immediate_actions.sort(key=lambda x: x['priority_score'], reverse=True)
        automated_fixes.sort(key=lambda x: x['priority_score'], reverse=True)
        manual_fixes.sort(key=lambda x: x['priority_score'], reverse=True)
        
        # Calculate effort estimates
        total_effort = sum(issue['estimated_effort'] for issue in enhanced_issues)
        automated_effort = sum(issue['estimated_effort'] * 0.3 for issue in automated_fixes)  # 70% reduction
        manual_effort = sum(issue['estimated_effort'] for issue in manual_fixes + immediate_actions)
        
        return {
            'immediate_actions': {
                'count': len(immediate_actions),
                'issues': immediate_actions[:10],  # Top 10 most critical
                'estimated_hours': round(sum(i['estimated_effort'] for i in immediate_actions) / 60, 1)
            },
            'automated_fixes': {
                'count': len(automated_fixes),
                'issues': automated_fixes[:10],  # Top 10 automated fixes
                'estimated_hours': round(automated_effort / 60, 1),
                'time_saved': round((sum(i['estimated_effort'] for i in automated_fixes) - automated_effort) / 60, 1)
            },
            'manual_fixes': {
                'count': len(manual_fixes),
                'issues': manual_fixes[:10],  # Top 10 manual fixes
                'estimated_hours': round(manual_effort / 60, 1)
            },
            'summary': {
                'total_issues': len(enhanced_issues),
                'total_estimated_hours': round(total_effort / 60, 1),
                'optimized_hours': round((automated_effort + manual_effort) / 60, 1),
                'time_savings': round((total_effort - automated_effort - manual_effort) / 60, 1),
                'automation_percentage': round((len(automated_fixes) / len(enhanced_issues)) * 100, 1) if enhanced_issues else 0
            }
        }
    
    def _save_enhanced_scan_result(self, enhanced_result: Dict[str, Any], project_id: str):
        """Save enhanced scan result to file"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"enhanced_scan_{project_id}_{timestamp}.json"
        filepath = self.data_dir / "enhanced_scans" / filename
        
        # Create directory if it doesn't exist
        filepath.parent.mkdir(exist_ok=True)
        
        try:
            with open(filepath, 'w') as f:
                json.dump(enhanced_result, f, indent=2, default=str)
            
            print(f"💾 Enhanced scan result saved: {filepath}")
        except Exception as e:
            print(f"⚠️ Error saving enhanced scan result: {e}")
    
    def apply_bulk_automated_fixes(self, project_id: str, issue_ids: List[str] = None) -> Dict[str, Any]:
        """Apply automated fixes to multiple issues"""
        
        print(f"🔧 Applying bulk automated fixes for project: {project_id}")
        
        if issue_ids is None:
            # Get all issues that can be automatically fixed
            issue_ids = []
            for issue in self.issue_manager.issues.values():
                if issue.rule_id in self.copilot_engine.fix_patterns:
                    issue_ids.append(issue.id)
        
        results = {
            'total_issues': len(issue_ids),
            'successful_fixes': 0,
            'failed_fixes': 0,
            'fix_details': [],
            'backup_files': [],
            'applied_at': datetime.now().isoformat()
        }
        
        for issue_id in issue_ids:
            try:
                issue = self.issue_manager.issues.get(issue_id)
                if not issue:
                    continue
                
                # Get code context
                code_snippet = self._get_issue_code_snippet(issue)
                
                # Generate and apply fix
                fix_result = self.copilot_engine.generate_automated_fix(issue, code_snippet)
                
                if fix_result['available']:
                    # Apply the fix
                    fix_applied = self._apply_fix_to_file(issue, fix_result)
                    
                    if fix_applied['success']:
                        results['successful_fixes'] += 1
                        results['backup_files'].append(fix_applied['backup_path'])
                        
                        # Update issue status
                        self.issue_manager.update_issue_status(issue_id, 'RESOLVED', 'automated_fix')
                        
                        results['fix_details'].append({
                            'issue_id': issue_id,
                            'rule_id': issue.rule_id,
                            'file_path': issue.file_path,
                            'line_number': issue.line_number,
                            'status': 'success',
                            'fix_description': fix_result['description']
                        })
                    else:
                        results['failed_fixes'] += 1
                        results['fix_details'].append({
                            'issue_id': issue_id,
                            'status': 'failed',
                            'error': fix_applied['error']
                        })
                else:
                    results['failed_fixes'] += 1
                    results['fix_details'].append({
                        'issue_id': issue_id,
                        'status': 'not_available',
                        'reason': fix_result['reason']
                    })
                    
            except Exception as e:
                results['failed_fixes'] += 1
                results['fix_details'].append({
                    'issue_id': issue_id,
                    'status': 'error',
                    'error': str(e)
                })
        
        print(f"✅ Bulk fix completed: {results['successful_fixes']} successful, {results['failed_fixes']} failed")
        
        # Save fix history
        self.fix_application_history.append(results)
        
        return results
    
    def _apply_fix_to_file(self, issue: SecurityIssue, fix_result: Dict[str, Any]) -> Dict[str, Any]:
        """Apply a fix to a specific file"""
        
        try:
            # Read current file content
            with open(issue.file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Create backup
            backup_path = f"{issue.file_path}.backup.{int(datetime.now().timestamp())}"
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Apply fix
            lines = content.split('\n')
            if issue.line_number <= len(lines):
                lines[issue.line_number - 1] = fix_result['fixed_code']
                
                # Write fixed content
                with open(issue.file_path, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines))
                
                return {
                    'success': True,
                    'backup_path': backup_path,
                    'fixed_code': fix_result['fixed_code']
                }
            else:
                return {
                    'success': False,
                    'error': 'Invalid line number'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_enhanced_dashboard_metrics(self, project_id: str = None) -> Dict[str, Any]:
        """Get enhanced dashboard metrics with Copilot integration"""
        
        # Get base metrics
        base_metrics = self.get_dashboard_metrics(project_id)
        
        if base_metrics.get('error'):
            return base_metrics
        
        # Get Copilot-specific metrics
        all_issues = list(self.issue_manager.issues.values())
        if project_id:
            all_issues = [i for i in all_issues if project_id in i.file_path]
        
        # Count automation opportunities
        automated_fixes_available = sum(1 for issue in all_issues 
                                      if issue.rule_id in self.copilot_engine.fix_patterns)
        
        # Count suggestions generated
        suggestions_generated = len([issue for issue in all_issues 
                                   if issue.id in self.copilot_engine.suggestion_cache])
        
        # Calculate time savings
        total_effort = sum(issue.effort for issue in all_issues)
        automated_effort = sum(issue.effort * 0.3 for issue in all_issues 
                             if issue.rule_id in self.copilot_engine.fix_patterns)
        time_savings = total_effort - automated_effort
        
        # Enhanced metrics
        enhanced_metrics = {
            **base_metrics,
            'copilot_integration': {
                'status': 'active' if self.copilot_engine.copilot_available else 'inactive',
                'suggestions_generated': suggestions_generated,
                'automated_fixes_available': automated_fixes_available,
                'automation_coverage': round((automated_fixes_available / len(all_issues)) * 100, 1) if all_issues else 0,
                'time_savings_hours': round(time_savings / 60, 1),
                'cache_stats': self.copilot_engine.get_cache_stats()
            },
            'remediation_insights': {
                'total_effort_hours': round(total_effort / 60, 1),
                'optimized_effort_hours': round((total_effort - time_savings) / 60, 1),
                'efficiency_gain': round((time_savings / total_effort) * 100, 1) if total_effort > 0 else 0,
                'high_priority_issues': len([i for i in all_issues if i.severity in ['BLOCKER', 'CRITICAL']]),
                'automation_ready': automated_fixes_available
            }
        }
        
        return enhanced_metrics
    
    def generate_security_report(self, project_id: str, include_suggestions: bool = True) -> Dict[str, Any]:
        """Generate comprehensive security report with Copilot insights"""
        
        print(f"📊 Generating comprehensive security report for: {project_id}")
        
        # Get latest scan for project
        project_scans = [s for s in self.scan_history if s.project_id == project_id]
        if not project_scans:
            return {'error': 'No scan data found for project'}
        
        latest_scan = max(project_scans, key=lambda x: x.timestamp)
        
        # Get enhanced metrics
        enhanced_metrics = self.get_enhanced_dashboard_metrics(project_id)
        
        # Generate suggestions if requested
        copilot_suggestions = {}
        if include_suggestions and latest_scan.issues:
            copilot_suggestions = self.copilot_engine.bulk_generate_suggestions(latest_scan.issues)
        
        # Create comprehensive report
        report = {
            'report_info': {
                'project_id': project_id,
                'generated_at': datetime.now().isoformat(),
                'scan_date': latest_scan.timestamp,
                'report_type': 'enhanced_security_report'
            },
            'executive_summary': {
                'overall_security_rating': latest_scan.security_rating,
                'quality_gate_status': latest_scan.quality_gate_status,
                'total_issues': len(latest_scan.issues),
                'critical_issues': len([i for i in latest_scan.issues if i.severity in ['BLOCKER', 'CRITICAL']]),
                'automation_opportunities': enhanced_metrics['copilot_integration']['automated_fixes_available'],
                'estimated_fix_time': enhanced_metrics['remediation_insights']['optimized_effort_hours']
            },
            'detailed_metrics': enhanced_metrics,
            'issue_analysis': {
                'by_severity': self._analyze_issues_by_severity(latest_scan.issues),
                'by_type': self._analyze_issues_by_type(latest_scan.issues),
                'by_file': self._analyze_issues_by_file(latest_scan.issues),
                'by_rule': self._analyze_issues_by_rule(latest_scan.issues)
            },
            'copilot_insights': {
                'suggestions_available': len(copilot_suggestions),
                'automation_coverage': enhanced_metrics['copilot_integration']['automation_coverage'],
                'time_savings': enhanced_metrics['copilot_integration']['time_savings_hours'],
                'high_confidence_suggestions': len([s for s in copilot_suggestions.values() if s.confidence == 'high'])
            },
            'remediation_plan': self._create_remediation_plan(
                [{'id': i.id, 'severity': i.severity, 'effort': i.effort, 
                  'copilot_suggestion': {'automated_fix_available': i.rule_id in self.copilot_engine.fix_patterns}} 
                 for i in latest_scan.issues],
                copilot_suggestions
            ),
            'recommendations': self._generate_project_recommendations(latest_scan, copilot_suggestions)
        }
        
        # Save report
        self._save_security_report(report, project_id)
        
        return report
    
    def _analyze_issues_by_severity(self, issues: List[SecurityIssue]) -> Dict[str, int]:
        """Analyze issues by severity level"""
        severity_counts = {}
        for issue in issues:
            severity_counts[issue.severity] = severity_counts.get(issue.severity, 0) + 1
        return severity_counts
    
    def _analyze_issues_by_type(self, issues: List[SecurityIssue]) -> Dict[str, int]:
        """Analyze issues by type"""
        type_counts = {}
        for issue in issues:
            type_counts[issue.type] = type_counts.get(issue.type, 0) + 1
        return type_counts
    
    def _analyze_issues_by_file(self, issues: List[SecurityIssue]) -> Dict[str, int]:
        """Analyze issues by file"""
        file_counts = {}
        for issue in issues:
            file_counts[issue.file_path] = file_counts.get(issue.file_path, 0) + 1
        return dict(sorted(file_counts.items(), key=lambda x: x[1], reverse=True)[:10])
    
    def _analyze_issues_by_rule(self, issues: List[SecurityIssue]) -> Dict[str, int]:
        """Analyze issues by rule"""
        rule_counts = {}
        for issue in issues:
            rule_counts[issue.rule_id] = rule_counts.get(issue.rule_id, 0) + 1
        return dict(sorted(rule_counts.items(), key=lambda x: x[1], reverse=True)[:10])
    
    def _save_security_report(self, report: Dict[str, Any], project_id: str):
        """Save security report to file"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"security_report_{project_id}_{timestamp}.json"
        filepath = self.data_dir / "reports" / filename
        
        # Create directory if it doesn't exist
        filepath.parent.mkdir(exist_ok=True)
        
        try:
            with open(filepath, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            
            print(f"📄 Security report saved: {filepath}")
        except Exception as e:
            print(f"⚠️ Error saving security report: {e}")


# Example usage and testing
if __name__ == "__main__":
    # Initialize enhanced scanner
    enhanced_scanner = EnhancedSecurityScanner()
    
    print("🧪 Testing Enhanced Security Scanner with Copilot Integration")
    print("=" * 70)
    
    # Test scanning current directory
    if len(sys.argv) > 1:
        project_path = sys.argv[1]
        project_id = sys.argv[2] if len(sys.argv) > 2 else "test-project"
    else:
        project_path = "."
        project_id = "test-project"
    
    print(f"📁 Scanning project: {project_path}")
    
    # Perform enhanced scan
    enhanced_result = enhanced_scanner.scan_project_with_copilot(project_path, project_id)
    
    print(f"\n📊 Enhanced Scan Results:")
    print(f"  • Total issues: {len(enhanced_result['base_scan']['issues'])}")
    print(f"  • Copilot suggestions: {enhanced_result['copilot_integration']['suggestions_generated']}")
    print(f"  • Automated fixes available: {enhanced_result['copilot_integration']['automated_fixes_available']}")
    print(f"  • High confidence suggestions: {enhanced_result['copilot_integration']['high_confidence_suggestions']}")
    
    # Test bulk automated fixes
    if enhanced_result['copilot_integration']['automated_fixes_available'] > 0:
        print(f"\n🔧 Testing bulk automated fixes...")
        fix_results = enhanced_scanner.apply_bulk_automated_fixes(project_id)
        print(f"  • Successful fixes: {fix_results['successful_fixes']}")
        print(f"  • Failed fixes: {fix_results['failed_fixes']}")
    
    # Generate comprehensive report
    print(f"\n📋 Generating comprehensive security report...")
    report = enhanced_scanner.generate_security_report(project_id)
    print(f"  • Overall security rating: {report['executive_summary']['overall_security_rating']}")
    print(f"  • Quality gate status: {report['executive_summary']['quality_gate_status']}")
    print(f"  • Estimated fix time: {report['executive_summary']['estimated_fix_time']} hours")
    
    print(f"\n✅ Enhanced Security Scanner test completed!")
    print(f"🤖 Copilot integration {'active' if enhanced_scanner.copilot_engine.copilot_available else 'inactive'}")
