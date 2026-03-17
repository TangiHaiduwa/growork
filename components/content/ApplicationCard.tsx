import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColor , ApplicationWithDetails } from '@/hooks';
import { ApplicationStatus } from '@/types/enums';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedAvatar } from '@/components/ui/ThemedAvatar';

interface ApplicationCardProps {
  application: ApplicationWithDetails;
  onStatusUpdate?: (applicationId: string, status: ApplicationStatus) => void;
  showActions?: boolean;
  showPostDetails?: boolean;
}

export function ApplicationCard({
  application,
  onStatusUpdate,
  showActions = true,
  showPostDetails = false,
}: ApplicationCardProps) {
  const router = useRouter();
  const applicant = application.profiles || {};
  const post = application.posts || {};
  const snapshotApplicant = application.application_snapshot?.applicant || {};

  const applicantDisplayName =
    application.applicant_name_snapshot ||
    [applicant.name, applicant.surname].filter(Boolean).join(' ').trim() ||
    applicant.full_name ||
    snapshotApplicant.full_name ||
    applicant.username ||
    'Unknown User';

  const jobDisplayTitle =
    application.job_title_snapshot || post.title || 'Unknown Job';

  const applicantAvatar =
    applicant.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(applicantDisplayName)}&size=50&background=111827&color=ffffff`;

  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const tintColor = useThemeColor({}, 'tint');

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.Pending:
        return '#FFA500';
      case ApplicationStatus.Reviewed:
        return '#525252';
      case ApplicationStatus.Accepted:
        return '#34C759';
      case ApplicationStatus.Rejected:
        return '#FF3B30';
      default:
        return mutedTextColor;
    }
  };

  const getStatusIcon = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.Pending:
        return 'clock';
      case ApplicationStatus.Reviewed:
        return 'eye';
      case ApplicationStatus.Accepted:
        return 'check-circle';
      case ApplicationStatus.Rejected:
        return 'x-circle';
      default:
        return 'circle';
    }
  };

  const handleViewDetails = () => {
    router.push(`/application/${application.id}`);
  };

  const getStatusLabel = (status: ApplicationStatus) => {
    if (status === ApplicationStatus.Accepted) {
      return 'Hired';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleStatusUpdate = (newStatus: ApplicationStatus) => {
    if (onStatusUpdate) {
      onStatusUpdate(application.id, newStatus);
    }
  };

  return (
    <ThemedView style={[styles.card, { borderColor }]}>
      <View style={styles.header}>
        <View style={styles.applicantInfo}>
          <ThemedAvatar
            size={50}
            image={applicantAvatar}
          />
          <View style={styles.applicantDetails}>
            <ThemedText style={[styles.applicantName, { color: textColor }]}>
              {applicantDisplayName}
            </ThemedText>
            <ThemedText style={[styles.postTitle, { color: mutedTextColor }]}>
              {jobDisplayTitle}
            </ThemedText>
            <ThemedText style={[styles.applicationDate, { color: mutedTextColor }]}>
              Applied {new Date(application.created_at).toLocaleDateString()}
            </ThemedText>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <Feather
            name={getStatusIcon(application.status)}
            size={20}
            color={getStatusColor(application.status)}
          />
          <ThemedText style={[styles.statusText, { color: getStatusColor(application.status) }]}>
            {getStatusLabel(application.status)}
          </ThemedText>
        </View>
      </View>

      {showPostDetails && (
        <View style={[styles.postDetails, { borderTopColor: borderColor }]}>
          <View style={styles.postDetailRow}>
            <Feather name="briefcase" size={14} color={mutedTextColor} />
            <ThemedText style={[styles.postDetailText, { color: mutedTextColor }]}>
              {post.type || 'Unknown Type'}
            </ThemedText>
          </View>
          {post.industry && (
            <View style={styles.postDetailRow}>
              <Feather name="map-pin" size={14} color={mutedTextColor} />
              <ThemedText style={[styles.postDetailText, { color: mutedTextColor }]}>
                {post.industry}
              </ThemedText>
            </View>
          )}
        </View>
      )}

      <View style={styles.content}>
        {application.cover_letter && (
          <View style={styles.attachmentRow}>
            <Feather name="file-text" size={16} color={mutedTextColor} />
            <ThemedText style={[styles.attachmentText, { color: mutedTextColor }]}>
              Cover Letter
            </ThemedText>
          </View>
        )}
        {(application.resume_url || application.cv_document_id_snapshot) && (
          <View style={styles.attachmentRow}>
            <Feather name="file" size={16} color={mutedTextColor} />
            <ThemedText style={[styles.attachmentText, { color: mutedTextColor }]}>
              Submitted CV
            </ThemedText>
          </View>
        )}
      </View>

      {showActions && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.viewButton, { borderColor }]}
            onPress={handleViewDetails}
          >
            <Feather name="eye" size={16} color={tintColor} />
            <ThemedText style={[styles.viewButtonText, { color: tintColor }]}>
              View Details
            </ThemedText>
          </TouchableOpacity>

          {onStatusUpdate && (
            <View style={styles.statusButtons}>
              {application.status === ApplicationStatus.Pending && (
                <>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: '#525252' }]}
                    onPress={() => handleStatusUpdate(ApplicationStatus.Reviewed)}
                  >
                    <Feather name="eye" size={14} color="#FFFFFF" />
                    <ThemedText style={styles.statusButtonText}>Review</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: '#34C759' }]}
                    onPress={() => handleStatusUpdate(ApplicationStatus.Accepted)}
                  >
                    <Feather name="check" size={14} color="#FFFFFF" />
                    <ThemedText style={styles.statusButtonText}>Accept</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: '#FF3B30' }]}
                    onPress={() => handleStatusUpdate(ApplicationStatus.Rejected)}
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                    <ThemedText style={styles.statusButtonText}>Reject</ThemedText>
                  </TouchableOpacity>
                </>
              )}
              {application.status === ApplicationStatus.Reviewed && (
                <>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: '#34C759' }]}
                    onPress={() => handleStatusUpdate(ApplicationStatus.Accepted)}
                  >
                    <Feather name="check" size={14} color="#FFFFFF" />
                    <ThemedText style={styles.statusButtonText}>Accept</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: '#FF3B30' }]}
                    onPress={() => handleStatusUpdate(ApplicationStatus.Rejected)}
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                    <ThemedText style={styles.statusButtonText}>Reject</ThemedText>
                  </TouchableOpacity>
                </>
              )}
              {application.status === ApplicationStatus.Accepted && (
                <TouchableOpacity
                  style={[styles.statusButton, { backgroundColor: '#525252' }]}
                  onPress={() => handleStatusUpdate(ApplicationStatus.Reviewed)}
                >
                  <Feather name="rotate-ccw" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.statusButtonText}>Undo hire</ThemedText>
                </TouchableOpacity>
              )}
              {application.status === ApplicationStatus.Rejected && (
                <TouchableOpacity
                  style={[styles.statusButton, { backgroundColor: '#525252' }]}
                  onPress={() => handleStatusUpdate(ApplicationStatus.Reviewed)}
                >
                  <Feather name="rotate-ccw" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.statusButtonText}>Reconsider</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  applicantInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  applicantDetails: {
    marginLeft: 12,
    flex: 1,
  },
  applicantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  postTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  applicationDate: {
    fontSize: 12,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  postDetails: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 12,
    gap: 4,
  },
  postDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postDetailText: {
    fontSize: 12,
    marginLeft: 6,
  },
  content: {
    marginBottom: 12,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  attachmentText: {
    fontSize: 14,
    marginLeft: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 2,
  },
}); 
