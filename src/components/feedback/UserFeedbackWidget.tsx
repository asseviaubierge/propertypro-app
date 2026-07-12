'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Star, 
  MessageSquare, 
  Send, 
  ThumbsUp, 
  ThumbsDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Users
} from 'lucide-react';

interface FeedbackEntry {
  id: string;
  userId: string;
  userRole: 'property_manager' | 'tenant' | 'admin';
  category: 'usability' | 'performance' | 'feature_request' | 'bug_report' | 'general';
  rating: number;
  title: string;
  description: string;
  feature?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'reviewing' | 'in_progress' | 'resolved' | 'closed';
  tags: string[];
  createdAt: Date;
  adminResponse?: string;
}

interface FeedbackSummary {
  totalFeedback: number;
  averageRating: number;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  userRoleBreakdown: Record<string, number>;
  trendAnalysis: {
    period: string;
    ratingTrend: 'improving' | 'declining' | 'stable';
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
    commonIssues: string[];
    topRequests: string[];
  };
}

export default function UserFeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    category: '',
    rating: 0,
    title: '',
    description: '',
    feature: '',
  });

  useEffect(() => {
    loadFeedback();
    loadSummary();
  }, []);

  const loadFeedback = async () => {
    try {
      const response = await fetch('/api/feedback?action=list');
      const data = await response.json();
      
      if (data.success) {
        setFeedback(data.data.feedback);
      }
    } catch (err) {
      console.error('Failed to load feedback:', err);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await fetch('/api/feedback?action=summary');
      const data = await response.json();
      
      if (data.success) {
        setSummary(data.data);
      }
    } catch (err) {
      console.error('Failed to load feedback summary:', err);
    }
  };

  const submitFeedback = async () => {
    if (!formData.category || !formData.rating || !formData.title || !formData.description) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'submit',
          feedbackData: {
            ...formData,
            tags: [formData.category, formData.feature].filter(Boolean),
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Feedback submitted successfully!');
        setFormData({
          category: '',
          rating: 0,
          title: '',
          description: '',
          feature: '',
        });
        setIsOpen(false);
        loadFeedback();
        loadSummary();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, interactive: boolean = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= rating 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
            onClick={interactive ? () => setFormData({ ...formData, rating: star }) : undefined}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      new: { variant: 'default', icon: Clock },
      reviewing: { variant: 'secondary', icon: MessageSquare },
      in_progress: { variant: 'default', icon: TrendingUp },
      resolved: { variant: 'default', icon: CheckCircle },
      closed: { variant: 'outline', icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityColors = {
      low: 'bg-green-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      critical: 'bg-red-500',
    };

    return (
      <Badge className={priorityColors[priority as keyof typeof priorityColors]}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Feedback Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalFeedback}</div>
              <p className="text-xs text-muted-foreground">
                Feedback submissions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.averageRating.toFixed(1)}/5</div>
              <div className="flex mt-1">
                {renderStars(Math.round(summary.averageRating))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Satisfaction Trend</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {summary.trendAnalysis.ratingTrend}
              </div>
              <p className="text-xs text-muted-foreground">
                Rating trend
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.statusBreakdown.new + summary.statusBreakdown.reviewing + summary.statusBreakdown.in_progress}
              </div>
              <p className="text-xs text-muted-foreground">
                Pending resolution
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feedback Widget */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>User Feedback</CardTitle>
              <CardDescription>
                Share your experience and help us improve
              </CardDescription>
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Submit Feedback
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>Submit Feedback</DialogTitle>
                  <DialogDescription>
                    Help us improve by sharing your experience
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usability">Usability</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="feature_request">Feature Request</SelectItem>
                        <SelectItem value="bug_report">Bug Report</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Rating *</Label>
                    <div className="flex items-center gap-2">
                      {renderStars(formData.rating, true)}
                      <span className="text-sm text-muted-foreground">
                        {formData.rating > 0 && `${formData.rating}/5`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Brief summary of your feedback"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Detailed description of your feedback"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="feature">Related Feature (Optional)</Label>
                    <Select value={formData.feature} onValueChange={(value) => setFormData({ ...formData, feature: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select feature" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment_dashboard">Payment Dashboard</SelectItem>
                        <SelectItem value="payment_processing">Payment Processing</SelectItem>
                        <SelectItem value="tenant_portal">Tenant Portal</SelectItem>
                        <SelectItem value="auto_pay">Auto-pay</SelectItem>
                        <SelectItem value="reports">Reports</SelectItem>
                        <SelectItem value="communication">Communication</SelectItem>
                        <SelectItem value="late_fees">Late Fees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={submitFeedback} disabled={loading}>
                      <Send className="h-4 w-4 mr-2" />
                      {loading ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="recent" className="space-y-4">
            <TabsList>
              <TabsTrigger value="recent">Recent Feedback</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="recent" className="space-y-4">
              {feedback.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No feedback submitted yet
                </div>
              ) : (
                <div className="space-y-4">
                  {feedback.slice(0, 5).map((item) => (
                    <Card key={item.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{item.title}</h4>
                            {getStatusBadge(item.status)}
                            {getPriorityBadge(item.priority)}
                          </div>
                          <div className="flex items-center gap-1">
                            {renderStars(item.rating)}
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {item.description}
                        </p>
                        
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{item.category.replace('_', ' ')}</Badge>
                            {item.feature && (
                              <Badge variant="outline">{item.feature.replace('_', ' ')}</Badge>
                            )}
                          </div>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>

                        {item.adminResponse && (
                          <div className="mt-3 p-3 bg-muted rounded-md">
                            <div className="flex items-center gap-2 mb-1">
                              <Users className="h-4 w-4" />
                              <span className="text-sm font-medium">Admin Response</span>
                            </div>
                            <p className="text-sm">{item.adminResponse}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              {summary && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Category Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(summary.categoryBreakdown).map(([category, count]) => (
                          <div key={category} className="flex justify-between">
                            <span className="capitalize">{category.replace('_', ' ')}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Status Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(summary.statusBreakdown).map(([status, count]) => (
                          <div key={status} className="flex justify-between">
                            <span className="capitalize">{status.replace('_', ' ')}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Common Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {summary.trendAnalysis.commonIssues.map((issue, index) => (
                          <Badge key={index} variant="outline" className="mr-1 mb-1">
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {summary.trendAnalysis.topRequests.map((request, index) => (
                          <Badge key={index} variant="outline" className="mr-1 mb-1">
                            {request}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
