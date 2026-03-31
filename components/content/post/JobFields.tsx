import React from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import JobTypeSelector from './JobTypeSelector';
import SalarySelector from './SalarySelector';
import IndustrySelector from './IndustrySelector';
import CompanySelector, { CompanySelectorData } from './CompanySelector';
import { INDUSTRIES } from '@/dataset/industries';
import { BorderRadius, Spacing } from '@/constants/DesignSystem';
import { useThemeColor } from '@/hooks';

export interface JobFieldsData {
  location: string;
  salary: string;
  jobType: string;
  industry: string;
  deadline: string;
  company: string;
  companyId?: string;
  companyLogo?: string;
}

interface JobFieldsProps {
  values: JobFieldsData;
  onChange: (values: JobFieldsData) => void;
  style?: ViewStyle;
}

export default function JobFields({ values, onChange, style }: JobFieldsProps) {
  const [pickerMode, setPickerMode] = React.useState<'date' | 'time' | null>(null);
  const pendingDeadlineRef = React.useRef<Date | null>(null);
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const mutedTextColor = useThemeColor({}, 'mutedText');

  const handleChange = (field: keyof JobFieldsData, value: string) => {
    onChange({ ...values, [field]: value });
  };

  const handleCompanyChange = (companyData: CompanySelectorData) => {
    onChange({
      ...values,
      company: companyData.company,
      companyId: companyData.companyId,
      companyLogo: companyData.companyLogo,
    });
  };

  const deadlineDate = values.deadline ? new Date(values.deadline) : null;
  const displayDeadline =
    deadlineDate && !Number.isNaN(deadlineDate.getTime())
      ? deadlineDate.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Select end date and time';

  const handleDeadlineChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (event.type === 'dismissed' || !selectedDate) {
      if (Platform.OS === 'android') {
        pendingDeadlineRef.current = null;
        setPickerMode(null);
      }
      return;
    }

    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        const pendingDate = new Date(selectedDate);
        pendingDate.setSeconds(0, 0);
        pendingDeadlineRef.current = pendingDate;
        setPickerMode('time');
        return;
      }

      const pendingDate = pendingDeadlineRef.current || new Date();
      pendingDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      pendingDeadlineRef.current = null;
      setPickerMode(null);
      handleChange('deadline', pendingDate.toISOString());
      return;
    }

    const normalizedDate = new Date(selectedDate);
    normalizedDate.setSeconds(0, 0);
    handleChange('deadline', normalizedDate.toISOString());
  };

  return (
    <View style={[styles.container, style]}>
      <CompanySelector
        values={{
          company: values.company,
          companyId: values.companyId,
          companyLogo: values.companyLogo,
        }}
        onChange={handleCompanyChange}
      />
      <ThemedInput
        placeholder="Location (e.g., Remote, New York, NY)"
        value={values.location}
        onChangeText={(v) => handleChange('location', v)}
      />
      <SalarySelector
        selectedSalary={values.salary}
        onSalaryChange={(v) => handleChange('salary', v)}
      />
      <JobTypeSelector
        selectedJobType={values.jobType}
        onJobTypeChange={(v: string) => handleChange('jobType', v)}
      />
      <View style={styles.deadlineSection}>
        <ThemedText style={[styles.deadlineLabel, { color: mutedTextColor }]}>
          Listing End Date & Time
        </ThemedText>
        <Pressable
          style={[styles.deadlineButton, { borderColor }]}
          onPress={() => setPickerMode('date')}
        >
          <ThemedText
            style={[
              styles.deadlineValue,
              { color: values.deadline ? textColor : mutedTextColor },
            ]}
          >
            {displayDeadline}
          </ThemedText>
        </Pressable>
        {pickerMode ? (
          <DateTimePicker
            value={deadlineDate && !Number.isNaN(deadlineDate.getTime()) ? deadlineDate : new Date()}
            mode={pickerMode}
            minimumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDeadlineChange}
          />
        ) : null}
      </View>
      <IndustrySelector
        selectedIndustry={values.industry}
        onIndustryChange={(v) => handleChange('industry', v)}
        industries={INDUSTRIES}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 16,
  },
  deadlineSection: {
    gap: Spacing.xs,
  },
  deadlineLabel: {
    fontSize: 13,
  },
  deadlineButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  deadlineValue: {
    fontSize: 16,
  },
});
