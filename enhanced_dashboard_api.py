#!/usr/bin/env python3
"""
Enhanced Dashboard API with GitHub Copilot Integration
Extended Flask API with AI-powered security suggestions
"""

from flask import Flask, request, jsonify, render_template_string, send_file
from flask_cors import CORS
import json
import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import uuid
import tempfile
from pathlib import Path
import threading
import time

# Import the security scanner components
from security_scanner_main import SecurityScanner, SecurityIssue, ScanResult
from copilot_suggestion_engine import CopilotSuggestionEngine, CopilotSuggestion, SecurityContext

app = Flask(__name__)
CORS(app)

# Global instances
scanner = SecurityScanner()
copilot_engine = CopilotSuggestionEngine()

# Store suggestion cache
suggestion_cache = {}

class SecurityAssistant:
    """Enhanced security assistant with Copilot integration"""
    
    def __init__(self, scanner: SecurityScanner, copilot_engine: CopilotSuggestionEngine):
        self.scanner = scanner
        self.copilot_engine = copilot_engine
        self.suggestion_cache = {}
        
    def get_comprehensive_suggestion(self, issue_id: str) -> Dict[str, Any]:
        """Get comprehensive security suggestion with Copilot integration"""
        
        # Check cache first
        if issue_id in self.suggestion_cache:
            cached_time = self.suggestion_cache[issue_id]['timestamp']
            if datetime.now() - cached_time < timedelta(hours=1):
                return self.suggestion_cache[issue_id]['data']
        
        # Get issue details
        issue = self.scanner.issue_manager.issues.get(issue_id)
        if not issue:
            return {'error': 'Issue not found'}
        
        # Get code context
        code_context = self._get_code_context(issue.file_path, issue.line_number)
        
        # Generate Copilot suggestion
        copilot_suggestion = self.copilot_engine.generate_security_suggestion(
            issue, code_context['snippet'], code_context['full_context']
        )
        
        # Get security context
        security_context = self.copilot_engine.get_security_context(issue.rule_id)
        
        # Generate automated fix
        automated_fix = self.copilot_engine.generate_automated_fix(issue, code_context['snippet'])
        
        # Get related issues
        related_issues = self._find_related_issues(issue)
        
        # Compile comprehensive response
        comprehensive_suggestion = {
            'issue_id': issue_id,
            'issue_details': {
                'rule_id': issue.rule_id,
                'message': issue.message,
                'severity': issue.severity,
                'type': issue.type,
                'file_path': issue.file_path,
                'line_number': issue.line_number,
                'status': issue.status
            },
            'copilot_suggestion': {
                'suggestion_text': copilot_suggestion.suggestion_text,
                'code_example': copilot_suggestion.code_example,
                'explanation': copilot_suggestion.explanation,
                'confidence': copilot_suggestion.confidence,
                'source': copilot_suggestion.source,
                'generated_at': copilot_suggestion.generated_at
            },
            'security_context': {
                'threat_description': security_context.threat_description if security_context else "Security vulnerability detected",
                'impact_level': security_context.impact_level if security_context else issue.severity,
                'compliance_standards': security_context.compliance_standards if security_context else [],
                'recommended_tools': security_context.recommended_tools if security_context else [],
                'prevention_tips': security_context.prevention_tips if security_context else []
            },
            'automated_fix': automated_fix,
            'code_context': code_context,
            'related_issues': related_issues,
            'remediation_effort': self._estimate_remediation_effort(issue, copilot_suggestion),
            'priority_score': self._calculate_priority_score(issue, security_context),
            'recommendations': self._generate_recommendations(issue, security_context, copilot_suggestion)
        }
        
        # Cache the result
        self.suggestion_cache[issue_id] = {
            'data': comprehensive_suggestion,
            'timestamp': datetime.now()
        }
        
        return comprehensive_suggestion
    
    def _get_code_context(self, file_path: str, line_number: int) -> Dict[str, str]:
        """Get code context around the issue"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            # Get 10 lines before and after for context
            start = max(0, line_number - 11)
            end = min(len(lines), line_number + 10)
            
            return {
                'snippet': lines[line_number - 1].strip() if line_number <= len(lines) else '',
                'context': ''.join(lines[start:end]),
                'full_context': ''.join(lines),
                'line_start': start + 1,
                'line_end': end,
                'total_lines': len(lines)
            }
        except Exception as e:
            return {
                'snippet': '',
                'context': '',
                'full_context': '',
                'line_start': 0,
                'line_end': 0,
                'total_lines': 0,
                'error': str(e)
            }
    
    def _find_related_issues(self, issue: SecurityIssue) -> List[Dict[str, Any]]:
        """Find related issues in the same file or with same rule"""
        related = []
        
        for other_issue in self.scanner.issue_manager.issues.values():
            if other_issue.id == issue.id:
                continue
                
            # Same file issues
            if other_issue.file_path == issue.file_path:
                related.append({
                    'issue_id': other_issue.id,
                    'rule_id': other_issue.rule_id,
                    'line_number': other_issue.line_number,
                    'severity': other_issue.severity,
                    'message': other_issue.message,
                    'relationship': 'same_file'
                })
            
            # Same rule issues
            elif other_issue.rule_id == issue.rule_id:
                related.append({
                    'issue_id': other_issue.id,
                    'file_path': other_issue.file_path,
                    'line_number': other_issue.line_number,
                    'severity': other_issue.severity,
                    'message': other_issue.message,
                    'relationship': 'same_rule'
                })
        
        return related[:10]  # Limit to 10 related issues
    
    def _estimate_remediation_effort(self, issue: SecurityIssue, copilot_suggestion: CopilotSuggestion) -> Dict[str, Any]:
        """Estimate remediation effort based on issue and suggestion"""
        
        base_effort = {
            'BLOCKER': 120,
            'CRITICAL': 60,
            'MAJOR': 30,
            'MINOR': 15,
            'INFO': 5
        }.get(issue.severity, 30)
        
        # Adjust based on automation availability
        if copilot_suggestion.automated_fix_available:
            effort_minutes = base_effort * 0.3  # 70% reduction with automation
            complexity = "LOW"
        else:
            effort_minutes = base_effort
            complexity = "MEDIUM" if issue.severity in ['MINOR', 'INFO'] else "HIGH"
        
        return {
            'estimated_minutes': int(effort_minutes),
            'estimated_hours': round(effort_minutes / 60, 1),
            'complexity': complexity,
            'automated_fix_available': copilot_suggestion.automated_fix_available,
            'confidence': copilot_suggestion.confidence
        }
    
    def _calculate_priority_score(self, issue: SecurityIssue, security_context: SecurityContext) -> int:
        """Calculate priority score (1-100) based on multiple factors"""
        
        # Base score from severity
        severity_scores = {
            'BLOCKER': 100,
            'CRITICAL': 80,
            'MAJOR': 60,
            'MINOR': 40,
            'INFO': 20
        }
        
        score = severity_scores.get(issue.severity, 50)
        
        # Adjust based on issue type
        if issue.type == 'VULNERABILITY':
            score += 10
        elif issue.type == 'SECURITY_HOTSPOT':
            score += 5
        
        # Adjust based on compliance impact
        if security_context and security_context.compliance_standards:
            score += len(security_context.compliance_standards) * 2
        
        # Adjust based on file type (some files are more critical)
        if any(pattern in issue.file_path for pattern in ['auth', 'login', 'password', 'config']):
            score += 10
        
        return min(100, max(1, score))
    
    def _generate_recommendations(self, issue: SecurityIssue, security_context: SecurityContext, 
                                copilot_suggestion: CopilotSuggestion) -> List[str]:
        """Generate specific recommendations for the issue"""
        
        recommendations = []
        
        # Immediate actions
        if issue.severity in ['BLOCKER', 'CRITICAL']:
            recommendations.append("🚨 **IMMEDIATE ACTION REQUIRED** - This is a critical security vulnerability")
        
        # Copilot-specific recommendations
        if copilot_suggestion.automated_fix_available:
            recommendations.append("🤖 **Automated fix available** - Use the suggested code replacement")
        else:
            recommendations.append("👨‍💻 **Manual fix required** - Review the suggested approach carefully")
        
        # Security context recommendations
        if security_context:
            if security_context.recommended_tools:
                tools = ', '.join(security_context.recommended_tools[:3])
                recommendations.append(f"🔧 **Recommended tools**: {tools}")
            
            if security_context.prevention_tips:
                recommendations.append(f"💡 **Prevention**: {security_context.prevention_tips[0]}")
        
        # File-specific recommendations
        if issue.file_path.endswith('.py'):
            recommendations.append("🐍 **Python best practices**: Use linting tools like bandit for security scanning")
        elif issue.file_path.endswith('.js'):
            recommendations.append("📜 **JavaScript security**: Consider using ESLint with security plugins")
        
        # Testing recommendations
        recommendations.append("🧪 **Testing**: Add security tests to prevent regression")
        
        return recommendations
    
    def apply_automated_fix(self, issue_id: str, fix_type: str = 'automated') -> Dict[str, Any]:
        """Apply automated fix to a security issue"""
        
        issue = self.scanner.issue_manager.issues.get(issue_id)
        if not issue:
            return {'success': False, 'error': 'Issue not found'}
        
        # Get code context
        code_context = self._get_code_context(issue.file_path, issue.line_number)
        
        # Generate automated fix
        fix_result = self.copilot_engine.generate_automated_fix(issue, code_context['snippet'])
        
        if not fix_result['available']:
            return {'success': False, 'error': fix_result['reason']}
        
        try:
            # Apply the fix to the file
            with open(issue.file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace the vulnerable code
            lines = content.split('\n')
            if issue.line_number <= len(lines):
                lines[issue.line_number - 1] = fix_result['fixed_code']
                
                # Create backup
                backup_path = f"{issue.file_path}.backup.{int(datetime.now().timestamp())}"
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                # Write fixed content
                with open(issue.file_path, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines))
                
                # Update issue status
                self.scanner.issue_manager.update_issue_status(issue_id, 'RESOLVED', 'automated_fix')
                
                return {
                    'success': True,
                    'message': 'Automated fix applied successfully',
                    'backup_path': backup_path,
                    'fixed_code': fix_result['fixed_code'],
                    'required_imports': fix_result.get('required_imports', [])
                }
            else:
                return {'success': False, 'error': 'Invalid line number'}
                
        except Exception as e:
            return {'success': False, 'error': f'Fix application failed: {str(e)}'}

# Initialize security assistant
security_assistant = SecurityAssistant(scanner, copilot_engine)

# Enhanced API Endpoints

@app.route('/api/issues/<issue_id>/copilot-suggestions')
def get_copilot_suggestions(issue_id):
    """Get Copilot-powered suggestions for a security issue"""
    try:
        suggestions = security_assistant.get_comprehensive_suggestion(issue_id)
        
        return jsonify({
            'issue_id': issue_id,
            'suggestions': suggestions,
            'generated_at': datetime.now().isoformat(),
            'powered_by': 'github_copilot'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/issues/<issue_id>/apply-copilot-fix', methods=['POST'])
def apply_copilot_fix(issue_id):
    """Apply Copilot-generated fix to a security issue"""
    try:
        data = request.get_json()
        fix_type = data.get('fix_type', 'automated')
        
        result = security_assistant.apply_automated_fix(issue_id, fix_type)
        
        return jsonify({
            'issue_id': issue_id,
            'fix_result': result,
            'applied_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/issues/bulk-suggestions', methods=['POST'])
def get_bulk_suggestions():
    """Get suggestions for multiple issues"""
    try:
        data = request.get_json()
        issue_ids = data.get('issue_ids', [])
        
        if not issue_ids:
            return jsonify({'error': 'No issue IDs provided'}), 400
        
        # Get issues
        issues = []
        for issue_id in issue_ids:
            issue = scanner.issue_manager.issues.get(issue_id)
            if issue:
                issues.append(issue)
        
        # Generate suggestions in bulk
        suggestions = copilot_engine.bulk_generate_suggestions(issues)
        
        return jsonify({
            'bulk_suggestions': {
                issue_id: {
                    'suggestion_text': suggestion.suggestion_text,
                    'confidence': suggestion.confidence,
                    'source': suggestion.source,
                    'automated_fix_available': suggestion.automated_fix_available
                }
                for issue_id, suggestion in suggestions.items()
            },
            'generated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/copilot/status')
def get_copilot_status():
    """Get Copilot integration status"""
    return jsonify({
        'copilot_available': copilot_engine.copilot_available,
        'cache_stats': copilot_engine.get_cache_stats(),
        'supported_languages': ['python', 'javascript', 'typescript', 'java', 'csharp', 'php'],
        'suggestion_sources': ['github_copilot', 'template', 'knowledge_base'],
        'automated_fix_rules': list(copilot_engine.fix_patterns.keys())
    })

@app.route('/api/copilot/cache/clear', methods=['POST'])
def clear_copilot_cache():
    """Clear Copilot suggestion cache"""
    try:
        copilot_engine.clear_cache()
        security_assistant.suggestion_cache.clear()
        
        return jsonify({
            'success': True,
            'message': 'Cache cleared successfully',
            'cleared_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security-context/<rule_id>')
def get_security_context(rule_id):
    """Get security context for a specific rule"""
    try:
        context = copilot_engine.get_security_context(rule_id)
        
        if context:
            return jsonify({
                'rule_id': rule_id,
                'security_context': {
                    'threat_description': context.threat_description,
                    'impact_level': context.impact_level,
                    'compliance_standards': context.compliance_standards,
                    'recommended_tools': context.recommended_tools,
                    'prevention_tips': context.prevention_tips
                }
            })
        else:
            return jsonify({'error': 'Security context not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/issues/<issue_id>/priority-score')
def get_issue_priority_score(issue_id):
    """Get priority score for an issue"""
    try:
        issue = scanner.issue_manager.issues.get(issue_id)
        if not issue:
            return jsonify({'error': 'Issue not found'}), 404
        
        security_context = copilot_engine.get_security_context(issue.rule_id)
        priority_score = security_assistant._calculate_priority_score(issue, security_context)
        
        return jsonify({
            'issue_id': issue_id,
            'priority_score': priority_score,
            'priority_level': 'HIGH' if priority_score >= 80 else 'MEDIUM' if priority_score >= 50 else 'LOW',
            'calculated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/copilot-metrics')
def get_copilot_metrics():
    """Get Copilot-specific dashboard metrics"""
    try:
        # Get all issues
        all_issues = list(scanner.issue_manager.issues.values())
        
        # Count by automation availability
        automated_fixes_available = 0
        copilot_suggestions_generated = 0
        
        for issue in all_issues:
            if issue.rule_id in copilot_engine.fix_patterns:
                automated_fixes_available += 1
            
            # Check if suggestion exists in cache
            if issue.id in security_assistant.suggestion_cache:
                copilot_suggestions_generated += 1
        
        # Get cache stats
        cache_stats = copilot_engine.get_cache_stats()
        
        return jsonify({
            'copilot_integration': {
                'status': 'active' if copilot_engine.copilot_available else 'inactive',
                'total_issues': len(all_issues),
                'automated_fixes_available': automated_fixes_available,
                'automation_coverage': round((automated_fixes_available / len(all_issues)) * 100, 1) if all_issues else 0,
                'suggestions_generated': copilot_suggestions_generated,
                'cache_entries': cache_stats.get('total_entries', 0),
                'cache_size_mb': cache_stats.get('total_size_mb', 0)
            },
            'suggestion_sources': {
                'github_copilot': copilot_suggestions_generated,
                'template_based': len(all_issues) - copilot_suggestions_generated,
                'knowledge_base': len(copilot_engine.security_contexts)
            },
            'automation_by_rule': {
                rule_id: {
                    'automated_fix_available': True,
                    'confidence': pattern.get('confidence', 'medium')
                }
                for rule_id, pattern in copilot_engine.fix_patterns.items()
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Enhanced file upload scanning with Copilot integration
@app.route('/api/scan/files-with-copilot', methods=['POST'])
def scan_uploaded_files_with_copilot():
    """Scan uploaded files and generate Copilot suggestions"""
    try:
        data = request.get_json()
        scan_id = data.get('scan_id', str(uuid.uuid4()))
        file_contents = data.get('file_contents', [])
        project_id = data.get('project_id', f'upload-scan-{int(datetime.now().timestamp())}')
        
        if not file_contents:
            return jsonify({'error': 'No files provided'}), 400
        
        # Perform regular scan first
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            issues = []
            
            for file_data in file_contents:
                file_path = temp_path / file_data['name']
                file_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(file_data['content'])
                
                # Scan file
                applicable_rules = scanner.rules_engine.get_enabled_rules(file_data['type'])
                file_issues = scanner._scan_file_with_rules(
                    str(file_path), file_data['content'], applicable_rules
                )
                issues.extend(file_issues)
            
            # Generate Copilot suggestions for all issues
            if issues:
                copilot_suggestions = copilot_engine.bulk_generate_suggestions(issues)
                
                # Enhance issues with suggestions
                enhanced_issues = []
                for issue in issues:
                    issue_dict = {
                        'id': issue.id,
                        'rule_id': issue.rule_id,
                        'file_path': issue.file_path,
                        'line_number': issue.line_number,
                        'message': issue.message,
                        'severity': issue.severity,
                        'type': issue.type,
                        'code_snippet': issue.code_snippet,
                        'suggested_fix': issue.suggested_fix
                    }
                    
                    # Add Copilot suggestion if available
                    if issue.id in copilot_suggestions:
                        copilot_suggestion = copilot_suggestions[issue.id]
                        issue_dict['copilot_suggestion'] = {
                            'suggestion_text': copilot_suggestion.suggestion_text,
                            'code_example': copilot_suggestion.code_example,
                            'confidence': copilot_suggestion.confidence,
                            'source': copilot_suggestion.source,
                            'automated_fix_available': copilot_suggestion.automated_fix_available
                        }
                    
                    enhanced_issues.append(issue_dict)
                
                return jsonify({
                    'scan_id': scan_id,
                    'project_id': project_id,
                    'files_scanned': len(file_contents),
                    'issues_found': len(issues),
                    'issues_with_copilot_suggestions': len(copilot_suggestions),
                    'enhanced_issues': enhanced_issues,
                    'copilot_integration': {
                        'suggestions_generated': len(copilot_suggestions),
                        'automation_available': sum(1 for s in copilot_suggestions.values() if s.automated_fix_available),
                        'high_confidence_suggestions': sum(1 for s in copilot_suggestions.values() if s.confidence == 'high')
                    },
                    'scan_timestamp': datetime.now().isoformat()
                })
            else:
                return jsonify({
                    'scan_id': scan_id,
                    'project_id': project_id,
                    'files_scanned': len(file_contents),
                    'issues_found': 0,
                    'enhanced_issues': [],
                    'message': 'No security issues found'
                })
                
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Keep all existing endpoints from the original dashboard_api.py
# ... (include all the original endpoints here)

if __name__ == '__main__':
    print("🚀 Starting Enhanced Security Scanner Dashboard with Copilot Integration...")
    print("🤖 Copilot Integration Features:")
    print("  • AI-powered security fix suggestions")
    print("  • Automated code fixes for common vulnerabilities")
    print("  • Context-aware security guidance")
    print("  • Bulk suggestion generation")
    print("  • Priority scoring and recommendations")
    print("  • Security context and compliance mapping")
    print("\n🌐 Enhanced API Endpoints:")
    print("  • GET  /api/issues/<id>/copilot-suggestions")
    print("  • POST /api/issues/<id>/apply-copilot-fix")
    print("  • POST /api/issues/bulk-suggestions")
    print("  • GET  /api/copilot/status")
    print("  • POST /api/copilot/cache/clear")
    print("  • GET  /api/security-context/<rule_id>")
    print("  • GET  /api/dashboard/copilot-metrics")
    print("  • POST /api/scan/files-with-copilot")
    print("\n📊 Dashboard available at: http://localhost:5000")
    print("="*80)
    
    app.run(host='127.0.0.1', port=5000, debug=True)