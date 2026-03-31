/**
 * Quality Dashboard Component
 *
 * Comprehensive dashboard showing user's quality metrics, progress,
 * improvement suggestions, and actionable insights.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Lightbulb,
  Star,
  Award,
  Users,
  MessageSquare,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import TrustScoreIndicator from './TrustScoreIndicator';
import VerificationBadges from './VerificationBadges';
import { api } from '@/lib/api';

interface QualityDashboardProps {
  className?: string;
}

interface DashboardData {
  overall_progress: number;
  trust_score: number;
  profile_completeness: number;
  verification_badges: Record<string, boolean>;
  completion_status: Record<string, number>;
  score_trend: Array<{ date: string; score: number }>;
  improvement_suggestions: Array<{
    category: string;
    title: string;
    description: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
    estimated_points: number;
    action_url?: string;
  }>;
  can_appear_in_matches: boolean;
  can_send_intro_requests: boolean;
  next_milestone?: {
    target: string;
    current: number;
    target_value: number;
    progress: number;
  };
  last_updated: string;
}

const QualityDashboard: React.FC<QualityDashboardProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['vetting', 'dashboard'],
    queryFn: () => api.get<DashboardData>('/api/v1/vetting/dashboard'),
    staleTime: 30000, // 30 seconds
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.get('/api/v1/vetting/me?update_metrics=true'),
    onMutate: () => setIsRefreshing(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vetting'] });
      setTimeout(() => setIsRefreshing(false), 1000);
    },
    onError: () => setIsRefreshing(false),
  });

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !dashboard) {
    return <DashboardError onRetry={() => refetch()} />;
  }

  return (
    <div className={cn('quality-dashboard space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quality Dashboard</h1>
          <p className="text-muted-foreground">
            Track your progress and improve your platform reputation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={dashboard.can_appear_in_matches ? 'default' : 'destructive'}>
            {dashboard.can_appear_in_matches ? 'Visible in Matches' : 'Hidden from Matches'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <OverviewCard dashboard={dashboard} />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="improvements">Improvements</TabsTrigger>
          <TabsTrigger value="verifications">Verifications</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TrustScoreCard dashboard={dashboard} />
            <ProfileCompletenessCard dashboard={dashboard} />
            <AccessCard dashboard={dashboard} />
            <MilestoneCard dashboard={dashboard} />
          </div>
        </TabsContent>

        <TabsContent value="improvements" className="space-y-6">
          <ImprovementSuggestions suggestions={dashboard.improvement_suggestions} />
        </TabsContent>

        <TabsContent value="verifications" className="space-y-6">
          <VerificationCenter badges={dashboard.verification_badges} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsView dashboard={dashboard} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Overview Card Component
const OverviewCard: React.FC<{ dashboard: DashboardData }> = ({ dashboard }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Overall Progress
        </CardTitle>
        <CardDescription>
          Your journey to becoming a trusted member of the community
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">
              {Math.round(dashboard.overall_progress)}%
            </div>
            <Progress value={dashboard.overall_progress} className="h-3" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold text-blue-600">
                {dashboard.trust_score}
              </div>
              <div className="text-sm text-muted-foreground">Trust Score</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-green-600">
                {dashboard.profile_completeness}%
              </div>
              <div className="text-sm text-muted-foreground">Profile</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-purple-600">
                {Object.values(dashboard.verification_badges).filter(Boolean).length}
              </div>
              <div className="text-sm text-muted-foreground">Verified</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-orange-600">
                {dashboard.improvement_suggestions.length}
              </div>
              <div className="text-sm text-muted-foreground">To-Do</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Trust Score Card Component
const TrustScoreCard: React.FC<{ dashboard: DashboardData }> = ({ dashboard }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trust Score</CardTitle>
        <CardDescription>
          Your credibility score based on verifications and activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TrustScoreIndicator
          score={dashboard.trust_score}
          variant="detailed"
          showTrend={dashboard.score_trend.length > 1}
          trendData={calculateTrend(dashboard.score_trend)}
        />
      </CardContent>
    </Card>
  );
};

// Profile Completeness Card Component
const ProfileCompletenessCard: React.FC<{ dashboard: DashboardData }> = ({ dashboard }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Completeness</CardTitle>
        <CardDescription>
          Complete your profile to improve match quality
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold mb-2">
              {dashboard.profile_completeness}%
            </div>
            <Progress value={dashboard.profile_completeness} className="h-2" />
          </div>

          <div className="space-y-2">
            {Object.entries(dashboard.completion_status).map(([area, percentage]) => (
              <div key={area} className="flex items-center justify-between">
                <span className="text-sm capitalize">
                  {area.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-2">
                  <Progress value={percentage} className="w-20 h-1" />
                  <span className="text-xs text-muted-foreground w-8">
                    {percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full">
            <ExternalLink className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Access Card Component
const AccessCard: React.FC<{ dashboard: DashboardData }> = ({ dashboard }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Access</CardTitle>
        <CardDescription>
          What you can currently do on the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <AccessItem
            icon={Users}
            title="Appear in Matches"
            description="Other users can discover you"
            allowed={dashboard.can_appear_in_matches}
          />
          <AccessItem
            icon={MessageSquare}
            title="Send Introduction Requests"
            description="Reach out to potential co-founders"
            allowed={dashboard.can_send_intro_requests}
          />
        </div>

        {(!dashboard.can_appear_in_matches || !dashboard.can_send_intro_requests) && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 mb-1">
                  Limited Access
                </p>
                <p className="text-yellow-700">
                  Complete your profile and verifications to unlock full platform features.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Access Item Component
const AccessItem: React.FC<{
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  allowed: boolean;
}> = ({ icon: Icon, title, description, allowed }) => {
  return (
    <div className="flex items-start gap-3">
      <div className={cn(
        'rounded-full p-2',
        allowed ? 'bg-green-100' : 'bg-gray-100'
      )}>
        <Icon className={cn(
          'w-4 h-4',
          allowed ? 'text-green-600' : 'text-gray-400'
        )} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {allowed ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <Clock className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};

// Milestone Card Component
const MilestoneCard: React.FC<{ dashboard: DashboardData }> = ({ dashboard }) => {
  if (!dashboard.next_milestone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Congratulations!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            You&apos;ve completed all available milestones. Keep engaging with the platform to maintain your score!
          </p>
        </CardContent>
      </Card>
    );
  }

  const milestone = dashboard.next_milestone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Next Milestone
        </CardTitle>
        <CardDescription>{milestone.target}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">
              {milestone.current} / {milestone.target_value}
            </div>
            <Progress value={milestone.progress} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              {Math.round(milestone.progress)}% complete
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              +{milestone.target_value - milestone.current}
            </div>
            <div className="text-sm text-muted-foreground">
              points to next milestone
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Improvement Suggestions Component
const ImprovementSuggestions: React.FC<{
  suggestions: DashboardData['improvement_suggestions'];
}> = ({ suggestions }) => {
  const groupedSuggestions = suggestions.reduce((acc, suggestion) => {
    if (!acc[suggestion.category]) {
      acc[suggestion.category] = [];
    }
    acc[suggestion.category].push(suggestion);
    return acc;
  }, {} as Record<string, typeof suggestions>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-yellow-500" />
        <h2 className="text-xl font-semibold">Improvement Suggestions</h2>
      </div>

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Star className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Great work!</h3>
            <p className="text-muted-foreground">
              No immediate improvements needed. Keep engaging with the platform!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedSuggestions).map(([category, items]) => (
            <SuggestionCategory
              key={category}
              category={category}
              suggestions={items}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Suggestion Category Component
const SuggestionCategory: React.FC<{
  category: string;
  suggestions: DashboardData['improvement_suggestions'];
}> = ({ category, suggestions }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize text-lg">
          {category.replace('_', ' ')} Improvements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <SuggestionItem key={index} suggestion={suggestion} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Suggestion Item Component
const SuggestionItem: React.FC<{
  suggestion: DashboardData['improvement_suggestions'][0];
}> = ({ suggestion }) => {
  const impactColors = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <div className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium">{suggestion.title}</h4>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={impactColors[suggestion.impact]}>
              {suggestion.impact}
            </Badge>
            <Badge variant="outline">
              +{suggestion.estimated_points} pts
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {suggestion.description}
        </p>
        {suggestion.action_url && (
          <Button size="sm">
            <a href={suggestion.action_url}>
              Take Action
              <ArrowRight className="w-3 h-3 ml-1" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
};

// Verification Center Component
const VerificationCenter: React.FC<{
  badges: Record<string, boolean>;
}> = ({ badges }) => {
  const handleVerify = (type: string) => {
    // API call to start verification
    console.log('Starting verification for:', type);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Verification Center</h2>
        <p className="text-muted-foreground">
          Verify your accounts and credentials to build trust with potential co-founders
        </p>
      </div>

      <VerificationBadges
        badges={badges}
        layout="grid"
        size="lg"
        interactive={true}
        showProgress={true}
        onVerify={handleVerify}
      />
    </div>
  );
};

// Analytics View Component
const AnalyticsView: React.FC<{ dashboard: DashboardData }> = ({ dashboard }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Quality Analytics</h2>
        <p className="text-muted-foreground">
          Track your progress and understand your platform performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TrustScoreTrend scoreHistory={dashboard.score_trend} />
        <CompletionStatus status={dashboard.completion_status} />
      </div>
    </div>
  );
};

// Trust Score Trend Component
const TrustScoreTrend: React.FC<{
  scoreHistory: Array<{ date: string; score: number }>;
}> = ({ scoreHistory }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Trust Score Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {scoreHistory.length < 2 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Not enough data to show trends yet.</p>
            <p className="text-sm">Check back after a few days of activity!</p>
          </div>
        ) : (
          <div className="h-40">
            {/* Simple trend visualization - in a real app you'd use a proper chart library */}
            <div className="text-sm text-muted-foreground mb-2">
              Progress over time
            </div>
            {/* Placeholder for chart */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 h-32 rounded flex items-end justify-center">
              <p className="text-blue-600 font-medium">Trending upward! 📈</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Completion Status Component
const CompletionStatus: React.FC<{
  status: Record<string, number>;
}> = ({ status }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Completion Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(status).map(([area, percentage]) => (
            <div key={area}>
              <div className="flex justify-between text-sm mb-1">
                <span className="capitalize">{area.replace('_', ' ')}</span>
                <span>{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Loading Skeleton Component
const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-32 bg-gray-100 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
};

// Error Component
const DashboardError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  return (
    <Card>
      <CardContent className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to Load Dashboard</h3>
        <p className="text-muted-foreground mb-4">
          There was an error loading your quality dashboard.
        </p>
        <Button onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
};

// Utility Functions
const calculateTrend = (
  scoreHistory: Array<{ date: string; score: number }>,
): { direction: "up" | "down" | "stable"; change: number; period: string } | undefined => {
  if (scoreHistory.length < 2) return undefined

  const latest = scoreHistory[scoreHistory.length - 1];
  const previous = scoreHistory[scoreHistory.length - 2];
  const change = latest.score - previous.score;

  const direction: "up" | "down" | "stable" =
    change > 0 ? "up" : change < 0 ? "down" : "stable"

  return {
    direction,
    change: Math.abs(change),
    period: '7 days',
  };
};

export default QualityDashboard;