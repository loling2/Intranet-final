import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Clock, CheckCircle2, XCircle, Play, AlertCircle, Timer, RotateCcw, Loader2, ExternalLink, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { SocietyTheme } from './themes';
import { Exam } from './mockData';

interface Props {
  exams: Exam[];
  theme: SocietyTheme;
}

const statusConfig: Record<string, { label: string; icon: React.FC<{ size?: number; className?: string }>; color: string; bg: string; border: string }> = {
  pendiente: { label: 'Pendiente', icon: Clock, color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
  en_curso: { label: 'En curso', icon: Play, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  completado: { label: 'Completado', icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  suspendido: { label: 'Suspendido', icon: XCircle, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

const mockQuestions: Question[] = [
  { id: 'q1', text: 'Cual es el principal objetivo de la prevencion de riesgos laborales?', options: ['Evitar sanciones', 'Proteger la seguridad y salud de los trabajadores', 'Reducir costes de la empresa', 'Cumplir con la normativa sin mas'], correctIndex: 1 },
  { id: 'q2', text: 'Quien es responsable de la seguridad en el lugar de trabajo?', options: ['Solo el departamento de RRHH', 'Solo el trabajador', 'El empresario y los trabajadores de forma conjunta', 'Solo el responsable de prevencion'], correctIndex: 2 },
  { id: 'q3', text: 'Que debe hacer un trabajador ante una situacion de peligro grave e inminente?', options: ['Continuar trabajando y reportar al final del turno', 'Interrumpir su actividad y abandonar el lugar', 'Esperar instrucciones del supervisor', 'Llamar al departamento de prevencion'], correctIndex: 1 },
  { id: 'q4', text: 'Con que frecuencia se debe realizar la evaluacion de riesgos?', options: ['Solo al inicio de la actividad', 'Cada 5 anos', 'Cuando cambien las condiciones de trabajo o se detecten deficiencias', 'Solo si hay accidentes'], correctIndex: 2 },
  { id: 'q5', text: 'Que es un EPI (Equipo de Proteccion Individual)?', options: ['Un sistema de gestion', 'Un dispositivo que protege al trabajador de riesgos', 'Una senal de seguridad', 'Un protocolo de emergencia'], correctIndex: 1 },
];

export default function ExamsCard({ exams, theme }: Props) {
  const [loading, setLoading] = useState(true);
  const [displayedExams, setDisplayedExams] = useState<Exam[]>([]);
  const [ssoConnecting, setSsoConnecting] = useState(false);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examScore, setExamScore] = useState(0);

  // Simulate async API fetch
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setDisplayedExams(exams);
      setLoading(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, [exams]);

  const handleGoToExam = useCallback((exam: Exam) => {
    setSsoConnecting(true);
    setActiveExam(exam);
    setTimeout(() => {
      setSsoConnecting(false);
      setShowModal(true);
      setExamStarted(false);
      setCurrentQuestion(0);
      setSelectedAnswers({});
      setExamSubmitted(false);
      setExamScore(0);
    }, 2500);
  }, []);

  const handleStartExam = () => {
    setExamStarted(true);
  };

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    if (examSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmitExam = () => {
    let correct = 0;
    mockQuestions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) correct++;
    });
    const score = Math.round((correct / mockQuestions.length) * 100);
    setExamScore(score);
    setExamSubmitted(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setActiveExam(null);
    setExamStarted(false);
  };

  const pending = displayedExams.filter((e) => e.status === 'pendiente').length;
  const completed = displayedExams.filter((e) => e.status === 'completado').length;
  const failed = displayedExams.filter((e) => e.status === 'suspendido').length;
  const avgScore = displayedExams.filter((e) => e.score !== null).length > 0
    ? Math.round(displayedExams.filter((e) => e.score !== null).reduce((sum, e) => sum + (e.score ?? 0), 0) / displayedExams.filter((e) => e.score !== null).length)
    : 0;

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${theme.primary}12` }}
            >
              <ClipboardCheck size={20} style={{ color: theme.primary }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>
                Mis Examenes
              </h3>
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                {loading ? 'Cargando desde Moodle...' : `${displayedExams.length} examenes registrados`}
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div
            className="rounded-xl p-8 flex flex-col items-center justify-center"
            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
          >
            <div className="relative mb-4">
              <div
                className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: `${theme.border}`, borderTopColor: 'transparent' }}
              />
            </div>
            <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>
              Obteniendo examenes del servidor
            </p>
            <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>
              Conectando con la plataforma de formacion...
            </p>
          </div>
        )}

        {!loading && (
          <>
            {/* Summary Row */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-lg font-bold" style={{ color: '#64748B' }}>{pending}</p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>Pendientes</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <p className="text-lg font-bold" style={{ color: '#16A34A' }}>{completed}</p>
                <p className="text-xs" style={{ color: '#15803D' }}>Aprobados</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <p className="text-lg font-bold" style={{ color: '#DC2626' }}>{failed}</p>
                <p className="text-xs" style={{ color: '#B91C1C' }}>Suspendidos</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}>
                <p className="text-lg font-bold" style={{ color: theme.primary }}>{avgScore}%</p>
                <p className="text-xs" style={{ color: theme.textSecondary }}>Nota media</p>
              </div>
            </div>

            {/* Exam List */}
            <div className="space-y-3">
              {displayedExams.map((exam) => {
                const cfg = statusConfig[exam.status];
                const StatusIcon = cfg.icon;
                const isPassing = exam.score !== null && exam.score >= 60;

                return (
                  <div
                    key={exam.id}
                    className="rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md"
                    style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${cfg.color}15` }}
                        >
                          <StatusIcon size={16} style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold leading-tight mb-0.5" style={{ color: theme.textPrimary }}>
                            {exam.title}
                          </h4>
                          <p className="text-xs" style={{ color: theme.textSecondary }}>{exam.course}</p>
                        </div>
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-md flex-shrink-0"
                          style={{ color: cfg.color, backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.border}` }}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${cfg.border}` }}>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} style={{ color: theme.textSecondary }} />
                          <span className="text-xs" style={{ color: theme.textSecondary }}>{exam.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Timer size={12} style={{ color: theme.textSecondary }} />
                          <span className="text-xs" style={{ color: theme.textSecondary }}>{exam.duration}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RotateCcw size={12} style={{ color: theme.textSecondary }} />
                          <span className="text-xs" style={{ color: theme.textSecondary }}>{exam.attempts} intento{exam.attempts !== 1 ? 's' : ''}</span>
                        </div>

                        {exam.score !== null && (
                          <div className="ml-auto flex items-center gap-1.5">
                            {isPassing ? <CheckCircle2 size={14} style={{ color: '#16A34A' }} /> : <AlertCircle size={14} style={{ color: '#DC2626' }} />}
                            <span className="text-sm font-bold" style={{ color: isPassing ? '#16A34A' : '#DC2626' }}>{exam.score}%</span>
                          </div>
                        )}

                        {(exam.status === 'pendiente' || exam.status === 'en_curso' || exam.status === 'suspendido') && (
                          <button
                            onClick={() => handleGoToExam(exam)}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
                            style={{
                              backgroundColor: exam.status === 'suspendido' ? '#FEF2F2' : theme.primary,
                              color: exam.status === 'suspendido' ? '#DC2626' : '#FFFFFF',
                              border: exam.status === 'suspendido' ? '1px solid #FECACA' : 'none',
                            }}
                          >
                            <ExternalLink size={12} />
                            {exam.status === 'pendiente' && 'Ir al Examen'}
                            {exam.status === 'en_curso' && 'Continuar Examen'}
                            {exam.status === 'suspendido' && 'Recuperar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* SSO Connecting Overlay */}
      {ssoConnecting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div
            className="rounded-2xl p-8 flex flex-col items-center max-w-sm w-full mx-4"
            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
          >
            <div className="relative mb-5">
              <div
                className="w-16 h-16 rounded-full border-4 animate-spin"
                style={{ borderColor: `${theme.border}`, borderTopColor: theme.primary }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center"
              >
                <ExternalLink size={20} style={{ color: theme.primary }} />
              </div>
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: theme.textPrimary }}>
              Conectando con Moodle mediante SSO...
            </h3>
            <p className="text-xs text-center mb-4" style={{ color: theme.textSecondary }}>
              Autenticando con tu cuenta de {activeExam?.course ?? 'la plataforma'}
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.primary, animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.primary, animationDelay: '300ms' }} />
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.primary, animationDelay: '600ms' }} />
            </div>
          </div>
        </div>
      )}

      {/* Exam Modal */}
      {showModal && activeExam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div
            className="rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden"
            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
          >
            {/* Modal Header */}
            <div
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: `1px solid ${theme.border}`, background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
            >
              <div>
                <h3 className="text-white font-semibold text-sm">{activeExam.title}</h3>
                <p className="text-white/70 text-xs">{activeExam.course} &middot; {activeExam.duration}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {!examStarted && !examSubmitted && (
                /* Pre-exam screen */
                <div className="flex flex-col items-center text-center py-6">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: `${theme.primary}12` }}
                  >
                    <ClipboardCheck size={36} style={{ color: theme.primary }} />
                  </div>
                  <h2 className="text-lg font-bold mb-2" style={{ color: theme.textPrimary }}>
                    {activeExam.title}
                  </h2>
                  <p className="text-sm mb-6" style={{ color: theme.textSecondary }}>
                    {activeExam.course}
                  </p>

                  <div
                    className="w-full max-w-xs space-y-3 mb-6 text-left"
                    style={{ border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '16px', backgroundColor: theme.primaryLight }}
                  >
                    <div className="flex justify-between">
                      <span className="text-xs" style={{ color: theme.textSecondary }}>Duracion</span>
                      <span className="text-xs font-medium" style={{ color: theme.textPrimary }}>{activeExam.duration}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs" style={{ color: theme.textSecondary }}>Preguntas</span>
                      <span className="text-xs font-medium" style={{ color: theme.textPrimary }}>{mockQuestions.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs" style={{ color: theme.textSecondary }}>Nota minima</span>
                      <span className="text-xs font-medium" style={{ color: theme.textPrimary }}>60%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs" style={{ color: theme.textSecondary }}>Autenticado via</span>
                      <span className="text-xs font-medium" style={{ color: theme.primary }}>SSO</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                    <span className="text-xs font-medium" style={{ color: '#15803D' }}>
                      Sesion autenticada correctamente via SSO
                    </span>
                  </div>

                  <button
                    onClick={handleStartExam}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold text-sm cursor-pointer transition-all duration-300"
                    style={{
                      backgroundColor: theme.primary,
                      boxShadow: `0 4px 14px ${theme.primary}40`,
                    }}
                  >
                    <Play size={16} />
                    Comenzar Examen
                  </button>
                </div>
              )}

              {examStarted && !examSubmitted && (
                /* Question screen */
                <div>
                  {/* Progress bar */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>
                      Pregunta {currentQuestion + 1} de {mockQuestions.length}
                    </span>
                    <span className="text-xs font-medium" style={{ color: theme.primary }}>
                      {Math.round(((currentQuestion + 1) / mockQuestions.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full mb-6" style={{ backgroundColor: `${theme.primary}15` }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${((currentQuestion + 1) / mockQuestions.length) * 100}%`,
                        backgroundColor: theme.primary,
                      }}
                    />
                  </div>

                  {/* Question */}
                  <h3 className="text-base font-semibold mb-5" style={{ color: theme.textPrimary }}>
                    {mockQuestions[currentQuestion].text}
                  </h3>

                  {/* Options */}
                  <div className="space-y-3 mb-8">
                    {mockQuestions[currentQuestion].options.map((option, i) => {
                      const isSelected = selectedAnswers[mockQuestions[currentQuestion].id] === i;
                      return (
                        <button
                          key={i}
                          onClick={() => handleSelectAnswer(mockQuestions[currentQuestion].id, i)}
                          className="w-full text-left px-4 py-3.5 rounded-xl text-sm transition-all duration-200 cursor-pointer"
                          style={{
                            backgroundColor: isSelected ? theme.primaryLight : theme.bg,
                            border: `1.5px solid ${isSelected ? theme.primary : theme.border}`,
                            color: isSelected ? theme.primary : theme.textPrimary,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                              style={{
                                backgroundColor: isSelected ? theme.primary : 'transparent',
                                color: isSelected ? '#FFFFFF' : theme.textSecondary,
                                border: `1.5px solid ${isSelected ? theme.primary : theme.border}`,
                              }}
                            >
                              {String.fromCharCode(65 + i)}
                            </div>
                            {option}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
                      disabled={currentQuestion === 0}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: theme.primaryLight, color: theme.primary, border: `1px solid ${theme.border}` }}
                    >
                      <ChevronLeft size={16} />
                      Anterior
                    </button>

                    {currentQuestion < mockQuestions.length - 1 ? (
                      <button
                        onClick={() => setCurrentQuestion((prev) => prev + 1)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200"
                        style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}
                      >
                        Siguiente
                        <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmitExam}
                        className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200"
                        style={{
                          backgroundColor: theme.primary,
                          color: '#FFFFFF',
                          boxShadow: `0 4px 14px ${theme.primary}40`,
                        }}
                      >
                        <CheckCircle2 size={16} />
                        Enviar Examen
                      </button>
                    )}
                  </div>
                </div>
              )}

              {examSubmitted && (
                /* Results screen */
                <div className="flex flex-col items-center text-center py-6">
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center mb-5"
                    style={{
                      backgroundColor: examScore >= 60 ? '#F0FDF4' : '#FEF2F2',
                      border: `3px solid ${examScore >= 60 ? '#22C55E' : '#EF4444'}`,
                    }}
                  >
                    {examScore >= 60 ? (
                      <CheckCircle2 size={40} style={{ color: '#22C55E' }} />
                    ) : (
                      <XCircle size={40} style={{ color: '#EF4444' }} />
                    )}
                  </div>

                  <h2 className="text-xl font-bold mb-1" style={{ color: theme.textPrimary }}>
                    {examScore >= 60 ? 'Enhorabuena!' : 'Lo sentimos'}
                  </h2>
                  <p className="text-sm mb-6" style={{ color: theme.textSecondary }}>
                    {examScore >= 60 ? 'Has superado el examen correctamente' : 'No has alcanzado la nota minima'}
                  </p>

                  <div
                    className="w-full max-w-xs rounded-xl p-5 mb-6"
                    style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}
                  >
                    <p className="text-4xl font-bold mb-1" style={{ color: examScore >= 60 ? '#16A34A' : '#DC2626' }}>
                      {examScore}%
                    </p>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>
                      Nota minima: 60%
                    </p>
                  </div>

                  {/* Answer Review */}
                  <div className="w-full space-y-2 mb-6">
                    {mockQuestions.map((q, i) => {
                      const isCorrect = selectedAnswers[q.id] === q.correctIndex;
                      return (
                        <div
                          key={q.id}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-left"
                          style={{
                            backgroundColor: isCorrect ? '#F0FDF4' : '#FEF2F2',
                            border: `1px solid ${isCorrect ? '#BBF7D0' : '#FECACA'}`,
                          }}
                        >
                          {isCorrect ? (
                            <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
                          ) : (
                            <XCircle size={16} style={{ color: '#DC2626' }} />
                          )}
                          <span className="text-xs font-medium flex-1" style={{ color: theme.textPrimary }}>
                            Pregunta {i + 1}
                          </span>
                          <span className="text-xs font-medium" style={{ color: isCorrect ? '#16A34A' : '#DC2626' }}>
                            {isCorrect ? 'Correcta' : 'Incorrecta'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleCloseModal}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300"
                    style={{ backgroundColor: theme.primary, color: '#FFFFFF', boxShadow: `0 4px 14px ${theme.primary}40` }}
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
