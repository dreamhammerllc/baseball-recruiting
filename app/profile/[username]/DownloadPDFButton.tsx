'use client';

import { useState } from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PDFSchoolMatch {
  school_name: string;
  fit_score: number;
  athletic_fit: number | null;
  reason: string | null;
  division: string | null;
}

export interface PDFDevelopmentRoadmap {
  onField: string[];
  academic: string;
  timeline: string;
}

export interface DownloadPDFButtonProps {
  athleteName: string;
  position?: string | null;
  gradYear?: string | null;
  homeState?: string | null;
  gpa?: number | null;
  sat?: number | null;
  exitVelocity?: number | null;
  dashTime?: number | null;
  fastballVelo?: number | null;
  era?: number | null;
  armStrength?: number | null;
  popTime?: number | null;
  battingAverage?: number | null;
  scoutAssessment?: string | null;
  schoolMatches: PDFSchoolMatch[];
  developmentRoadmap?: PDFDevelopmentRoadmap | null;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0e14',
  surface: '#111827',
  surfaceAlt: '#0d1117',
  border: '#1e2530',
  amber: '#e8a020',
  blue: '#3b82f6',
  green: '#10b981',
  white: '#ffffff',
  gray200: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
} as const;

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingTop: 40,
    paddingBottom: 44,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    flexDirection: 'column',
  },

  // Header
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.amber,
    marginRight: 6,
  },
  brandText: {
    fontSize: 8,
    color: C.amber,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },
  athleteName: {
    fontSize: 26,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  athleteSub: {
    fontSize: 10,
    color: C.gray500,
    marginBottom: 16,
  },
  headerRule: {
    height: 1,
    backgroundColor: C.amber,
    opacity: 0.35,
    marginBottom: 22,
  },

  // Section label
  sectionWrap: {
    marginBottom: 18,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionBar: {
    width: 3,
    height: 12,
    backgroundColor: C.amber,
    borderRadius: 2,
    marginRight: 6,
  },
  sectionLabelText: {
    fontSize: 7,
    color: C.gray400,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.3,
  },

  // Stat pills
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statPill: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 6,
    padding: 8,
    width: '30%',
    marginRight: '3%',
    marginBottom: 7,
  },
  statPillLabel: {
    fontSize: 6,
    color: C.gray500,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  statPillValue: {
    fontSize: 13,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
  },

  // Scout assessment
  assessmentCard: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
    borderRightWidth: 1,
    borderRightColor: C.border,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
    borderLeftStyle: 'solid',
    borderRadius: 6,
    padding: 14,
  },
  assessmentText: {
    fontSize: 10,
    color: C.gray200,
    fontFamily: 'Helvetica-Oblique',
    lineHeight: 1.65,
    marginBottom: 7,
  },
  assessmentAttrib: {
    fontSize: 7,
    color: C.gray600,
    textAlign: 'right',
    fontFamily: 'Helvetica',
  },

  // School matches
  matchCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 6,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  rankBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  rankBubbleText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  matchInfo: {
    flex: 1,
  },
  matchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 3,
  },
  matchName: {
    fontSize: 10,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    marginRight: 6,
  },
  divBadge: {
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  divBadgeText: {
    fontSize: 6,
    color: C.gray400,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.4,
  },
  matchReason: {
    fontSize: 8,
    color: C.gray500,
    lineHeight: 1.5,
  },
  fitCol: {
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 10,
    minWidth: 32,
  },
  fitScore: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 1,
  },
  fitLabel: {
    fontSize: 6,
    color: C.gray600,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
  },

  // Development roadmap
  roadmapOuter: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 6,
    overflow: 'hidden',
  },
  roadmapBlock: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  roadmapBlockLast: {
    padding: 12,
  },
  roadmapSubHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  roadmapDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 5,
  },
  roadmapSubLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  onFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  onFieldBadge: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.3)',
    borderStyle: 'solid',
    backgroundColor: 'rgba(232,160,32,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    flexShrink: 0,
    marginTop: 1,
  },
  onFieldBadgeText: {
    fontSize: 6,
    color: C.amber,
    fontFamily: 'Helvetica-Bold',
  },
  onFieldItemText: {
    fontSize: 9,
    color: C.gray200,
    lineHeight: 1.55,
    flex: 1,
  },
  roadmapBodyText: {
    fontSize: 9,
    color: C.gray200,
    lineHeight: 1.55,
  },

  // Footer
  spacer: {
    flex: 1,
  },
  footer: {
    paddingTop: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
  },
  footerText: {
    fontSize: 7,
    color: C.gray600,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
});

// ─── PDF Document ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <View style={S.sectionLabelRow}>
      <View style={S.sectionBar} />
      <Text style={S.sectionLabelText}>{children}</Text>
    </View>
  );
}

function AthleteDocument(props: DownloadPDFButtonProps) {
  // Build stats list — only include non-null values
  const stats: Array<{ label: string; value: string }> = [];
  if (props.fastballVelo != null)  stats.push({ label: 'FASTBALL VELO',  value: `${props.fastballVelo} mph` });
  if (props.exitVelocity != null)  stats.push({ label: 'EXIT VELOCITY',  value: `${props.exitVelocity} mph` });
  if (props.dashTime != null)      stats.push({ label: '60-YARD DASH',   value: `${props.dashTime}s` });
  if (props.popTime != null)       stats.push({ label: 'POP TIME',       value: `${props.popTime}s` });
  if (props.armStrength != null)   stats.push({ label: 'ARM STRENGTH',   value: `${props.armStrength} mph` });
  if (props.era != null)           stats.push({ label: 'ERA',            value: String(props.era) });
  if (props.battingAverage != null)stats.push({ label: 'BATTING AVG',   value: String(props.battingAverage) });
  if (props.gpa != null)           stats.push({ label: 'GPA',           value: String(props.gpa) });
  if (props.sat != null)           stats.push({ label: 'SAT',           value: String(props.sat) });

  const subtitle = [
    props.position,
    props.homeState,
    props.gradYear ? `Class of ${props.gradYear}` : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <Document title={`${props.athleteName} — Recruiting Profile`} author="BaseballRecruit">
      <Page size="A4" style={S.page}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={S.brandRow}>
          <View style={S.brandDot} />
          <Text style={S.brandText}>BASEBALLRECRUIT</Text>
        </View>
        <Text style={S.athleteName}>{props.athleteName}</Text>
        {subtitle ? <Text style={S.athleteSub}>{subtitle}</Text> : null}
        <View style={S.headerRule} />

        {/* ── Athlete Stats ───────────────────────────────────────── */}
        {stats.length > 0 && (
          <View style={S.sectionWrap}>
            <SectionLabel>ATHLETE STATS</SectionLabel>
            <View style={S.statGrid}>
              {stats.map((s) => (
                <View key={s.label} style={S.statPill}>
                  <Text style={S.statPillLabel}>{s.label}</Text>
                  <Text style={S.statPillValue}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Scout Assessment ────────────────────────────────────── */}
        {props.scoutAssessment ? (
          <View style={S.sectionWrap}>
            <SectionLabel>SCOUT ASSESSMENT</SectionLabel>
            <View style={S.assessmentCard}>
              <Text style={S.assessmentText}>{props.scoutAssessment}</Text>
              <Text style={S.assessmentAttrib}>AI-generated  ·  BaseballRecruit</Text>
            </View>
          </View>
        ) : null}

        {/* ── Top School Matches ──────────────────────────────────── */}
        {props.schoolMatches.length > 0 && (
          <View style={S.sectionWrap}>
            <SectionLabel>TOP SCHOOL MATCHES</SectionLabel>
            {props.schoolMatches.map((m, i) => {
              const fitColor = m.fit_score >= 80 ? C.amber : m.fit_score >= 60 ? C.blue : C.gray500;
              const isFirst = i === 0;
              return (
                <View key={`${m.school_name}-${i}`} style={S.matchCard}>
                  {/* Rank bubble */}
                  <View style={[
                    S.rankBubble,
                    {
                      backgroundColor: isFirst ? 'rgba(232,160,32,0.15)' : C.surfaceAlt,
                      borderColor: isFirst ? C.amber : C.border,
                    },
                  ]}>
                    <Text style={[S.rankBubbleText, { color: isFirst ? C.amber : C.gray500 }]}>
                      #{i + 1}
                    </Text>
                  </View>

                  {/* School info */}
                  <View style={S.matchInfo}>
                    <View style={S.matchNameRow}>
                      <Text style={S.matchName}>{m.school_name}</Text>
                      {m.division ? (
                        <View style={S.divBadge}>
                          <Text style={S.divBadgeText}>{m.division}</Text>
                        </View>
                      ) : null}
                    </View>
                    {m.reason ? (
                      <Text style={S.matchReason}>{m.reason}</Text>
                    ) : null}
                  </View>

                  {/* Fit score */}
                  <View style={S.fitCol}>
                    <Text style={[S.fitScore, { color: fitColor }]}>{m.fit_score}</Text>
                    <Text style={S.fitLabel}>FIT</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Development Roadmap ─────────────────────────────────── */}
        {props.developmentRoadmap ? (
          <View style={S.sectionWrap}>
            <SectionLabel>DEVELOPMENT ROADMAP</SectionLabel>
            <View style={S.roadmapOuter}>

              {/* On-Field Priorities */}
              <View style={S.roadmapBlock}>
                <View style={S.roadmapSubHead}>
                  <View style={[S.roadmapDot, { backgroundColor: C.amber }]} />
                  <Text style={[S.roadmapSubLabel, { color: C.amber }]}>ON-FIELD PRIORITIES</Text>
                </View>
                {props.developmentRoadmap.onField.map((item, i) => (
                  <View key={i} style={S.onFieldRow}>
                    <View style={S.onFieldBadge}>
                      <Text style={S.onFieldBadgeText}>{i + 1}</Text>
                    </View>
                    <Text style={S.onFieldItemText}>{item}</Text>
                  </View>
                ))}
              </View>

              {/* Academic Focus */}
              <View style={S.roadmapBlock}>
                <View style={S.roadmapSubHead}>
                  <View style={[S.roadmapDot, { backgroundColor: C.blue }]} />
                  <Text style={[S.roadmapSubLabel, { color: C.blue }]}>ACADEMIC FOCUS</Text>
                </View>
                <Text style={S.roadmapBodyText}>{props.developmentRoadmap.academic}</Text>
              </View>

              {/* Recruiting Timeline */}
              <View style={S.roadmapBlockLast}>
                <View style={S.roadmapSubHead}>
                  <View style={[S.roadmapDot, { backgroundColor: C.green }]} />
                  <Text style={[S.roadmapSubLabel, { color: C.green }]}>RECRUITING TIMELINE</Text>
                </View>
                <Text style={S.roadmapBodyText}>{props.developmentRoadmap.timeline}</Text>
              </View>

            </View>
          </View>
        ) : null}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={S.spacer} />
        <View style={S.footer}>
          <Text style={S.footerText}>DIAMOND VERIFIED  ·  BASEBALLRECRUIT</Text>
        </View>

      </Page>
    </Document>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

export default function DownloadPDFButton(props: DownloadPDFButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const blob = await pdf(<AthleteDocument {...props} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${props.athleteName.replace(/\s+/g, '-')}-recruiting-profile.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[pdf] download failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      style={{
        width: '100%',
        padding: '0.85rem',
        backgroundColor: 'transparent',
        border: '1px solid #1e2530',
        borderRadius: '0.75rem',
        color: '#9ca3af',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: loading ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        transition: 'all 0.15s ease',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          Generating PDF...
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PDF
        </>
      )}
    </button>
  );
}
