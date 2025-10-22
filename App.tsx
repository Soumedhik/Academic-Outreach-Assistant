import React, { useState, useCallback, useEffect } from 'react';
import { Step, Contact, Email, ResumeData, HistoryEntry } from './types';
import { findContacts, generateEmailForContact, parseResume } from './services/geminiService';
import StepIndicator from './components/StepIndicator';
import Loader from './components/Loader';
import { UploadIcon } from './components/icons/UploadIcon';
import { ChevronRightIcon } from './components/icons/ChevronRightIcon';
import { LinkIcon } from './components/icons/LinkIcon';
import { HistoryIcon } from './components/icons/HistoryIcon';
import { ArrowLeftIcon } from './components/icons/ArrowLeftIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { LinkedinIcon } from './components/icons/LinkedinIcon';

const SunIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const MoonIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
);


const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>(Step.Input);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [university, setUniversity] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('seeking a PhD research position');
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [emails, setEmails] = useState<Email[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<'app' | 'history'>('app');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isParsingResume, setIsParsingResume] = useState<boolean>(false);
  const [isGeneratingEmails, setIsGeneratingEmails] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };
  
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('academicOutreachHistory');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Failed to load history from localStorage", error);
      localStorage.removeItem('academicOutreachHistory');
    }
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setIsParsingResume(true);
      setError(null);
      setResumeData(null);
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result?.toString().split(',')[1];
        if (base64String) {
          try {
            const rawFile = {
              name: file.name,
              mimeType: file.type,
              data: base64String,
            };
            const parsedData = await parseResume(rawFile);
            setResumeData(parsedData);
          } catch(e) {
            console.error(e);
            setError("Failed to parse resume. The AI couldn't extract details. Please try another file.");
            setResumeData(null);
          } finally {
            setIsParsingResume(false);
          }
        }
      };
      reader.readAsDataURL(file);
    } else {
      setError('Please upload a valid PDF file.');
      setResumeData(null);
    }
  };

  const handleFindContacts = async () => {
    if (!resumeData || !university || !department) {
      setError('Please upload your resume and enter a university name and department.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const foundContacts = await findContacts(university, department, resumeData);
      setContacts(foundContacts);
      setSelectedContacts(new Set(foundContacts.filter(p => p.email).map(p => p.email as string)));
      setCurrentStep(Step.Select);
    } catch (e) {
      console.error(e);
      setError('Failed to find contacts. The model may have returned an unexpected format. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSelection = (email: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  };

  const handleGenerateEmails = useCallback(async () => {
    if (!resumeData || !purpose || selectedContacts.size === 0) {
        setError('Something went wrong. Please ensure resume, purpose, and contacts are selected.');
        return;
    }

    setIsGeneratingEmails(true);
    setError(null);
    setEmails([]);

    const contactsToEmail = contacts.filter(p => p.email && selectedContacts.has(p.email));

    const emailPromises = contactsToEmail.map(contact => 
        generateEmailForContact(contact, purpose, resumeData)
    );
    
    try {
        const generatedEmails = await Promise.all(emailPromises);
        const emailsWithStatus = generatedEmails.map(e => ({ ...e, sent: false }));
        setEmails(emailsWithStatus);
        setCurrentStep(Step.Review);
    } catch (e) {
        console.error(e);
        setError('An error occurred while generating emails. Please try again.');
    } finally {
        setIsGeneratingEmails(false);
    }
  }, [resumeData, purpose, selectedContacts, contacts]);

  const handleEmailChange = (index: number, newBody: string) => {
    setEmails(prev => {
      const newEmails = [...prev];
      newEmails[index].body = newBody;
      return newEmails;
    });
  };
  
   const handleSendAll = async () => {
    setIsSending(true);
    const newHistoryEntries: HistoryEntry[] = [];
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      if (!email.sent) {
        const mailtoLink = `mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body + '\n\n(Remember to attach your resume!)')}`;
        window.open(mailtoLink, '_blank');
        
        setEmails(prev => {
          const newEmails = [...prev];
          newEmails[i] = { ...newEmails[i], sent: true };
          return newEmails;
        });
        
        newHistoryEntries.push({
            to: email.to,
            subject: email.subject,
            body: email.body,
            dateSent: new Date().toISOString(),
        });

        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait before opening next
      }
    }
    
    if (newHistoryEntries.length > 0) {
        setHistory(prevHistory => {
            const updatedHistory = [...newHistoryEntries, ...prevHistory];
            localStorage.setItem('academicOutreachHistory', JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    }

    setIsSending(false);
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to permanently delete all email history?")) {
        setHistory([]);
        localStorage.removeItem('academicOutreachHistory');
    }
  };


  const handleBack = () => {
    if (currentStep === Step.Review) {
      setCurrentStep(Step.Select);
    } else if (currentStep === Step.Select) {
      setCurrentStep(Step.Input);
    }
  };

  const renderContent = () => {
    switch (currentStep) {
      case Step.Input:
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="university" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target University</label>
              <input
                type="text"
                id="university"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="e.g., Stanford University"
                className="block w-full px-4 py-3 bg-white/50 border border-slate-300/70 rounded-lg shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
              />
            </div>
             <div>
              <label htmlFor="department" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department / Field of Study</label>
              <input
                type="text"
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g., Computer Science"
                className="block w-full px-4 py-3 bg-white/50 border border-slate-300/70 rounded-lg shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Purpose of Email</label>
              <textarea
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
                className="block w-full px-4 py-3 bg-white/50 border border-slate-300/70 rounded-lg shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
              />
            </div>
             <div>
                <label htmlFor="resume-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Your Resume (PDF)</label>
                 <div className="relative bg-white/50 dark:bg-slate-900/30 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 p-6 flex flex-col justify-center items-center text-center">
                    {!isParsingResume && !resumeData && (
                        <label htmlFor="resume-upload" className="cursor-pointer">
                            <UploadIcon />
                            <span className="mt-2 text-sm text-slate-600 dark:text-slate-400">Click to upload your resume</span>
                            <input id="resume-upload" name="resume-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} />
                        </label>
                    )}
                    {isParsingResume && (
                        <div className="flex flex-col items-center">
                            <Loader />
                            <span className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium animate-pulse">Analyzing your resume...</span>
                        </div>
                    )}
                    {resumeData && !isParsingResume && (
                        <div className='w-full text-left'>
                            <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3">Successfully parsed resume: <span className="font-normal text-slate-600 dark:text-slate-300">{resumeData.name}</span></p>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Education Level:</h4>
                                    <p className="text-slate-600 dark:text-slate-300">{resumeData.educationLevel}</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Key Skills:</h4>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {resumeData.skills.map(skill => <span key={skill} className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-indigo-900/50 dark:text-indigo-300">{skill}</span>)}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Projects:</h4>
                                    <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1 mt-1">
                                        {resumeData.projects.map((proj, i) => <li key={i}>{proj}</li>)}
                                    </ul>
                                </div>
                            </div>
                            <label htmlFor="resume-upload" className="cursor-pointer text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 mt-4 inline-block">
                                Upload a different file
                                <input id="resume-upload" name="resume-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} />
                             </label>
                        </div>
                    )}
                </div>
            </div>
            <button
              onClick={handleFindContacts}
              disabled={isLoading || !resumeData || !university || !department}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400 dark:disabled:bg-slate-600 dark:disabled:from-slate-600 dark:disabled:to-slate-600 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-transform duration-200"
            >
              {isLoading ? <Loader /> : 'Find Contacts'}
              {!isLoading && <ChevronRightIcon />}
            </button>
          </div>
        );
      case Step.Select:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold leading-6 text-slate-900 dark:text-white">Select Contacts for Outreach</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2 -mr-2">
              {contacts.map((contact, index) => (
                <div key={`${contact.name}-${index}`} className="relative flex items-start p-4 border border-slate-200/80 rounded-lg bg-white/50 shadow-md transition-all duration-200 hover:shadow-xl hover:border-indigo-400/50 dark:bg-slate-800/50 dark:border-slate-700/80 dark:hover:border-indigo-500/50">
                  <div className="flex items-center h-5 mt-1">
                    <input
                      id={`contact-${index}`}
                      type="checkbox"
                      checked={!!contact.email && selectedContacts.has(contact.email)}
                      onChange={() => contact.email && handleContactSelection(contact.email)}
                      disabled={!contact.email}
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-offset-slate-800"
                    />
                  </div>
                  <div className="ml-4 text-sm flex-1">
                    <label htmlFor={`contact-${index}`} className={`font-semibold text-slate-900 text-base dark:text-white ${contact.email ? 'cursor-pointer' : 'opacity-70'}`}>{contact.name}</label>
                    <p className="text-indigo-600 dark:text-indigo-400 font-medium">{contact.title}</p>
                    {contact.email ? (
                        <p className="text-slate-500 dark:text-slate-400">{contact.email}</p>
                    ) : (
                        <p className="text-amber-600 dark:text-amber-500 font-semibold">Email not found</p>
                    )}
                    <p className="mt-2 text-slate-700 dark:text-slate-300">{contact.researchInterests}</p>
                    {contact.recentPublication && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recent Work: <em>{contact.recentPublication}</em></p>}
                    <div className="flex items-center space-x-4 mt-2">
                        {contact.labWebsite && (
                          <a href={contact.labWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">
                            <LinkIcon />
                            <span className="ml-1">Visit Website</span>
                          </a>
                        )}
                        {contact.linkedinProfile && (
                            <a href={contact.linkedinProfile} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">
                                <LinkedinIcon />
                                <span className="ml-1">LinkedIn Profile</span>
                            </a>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex space-x-4 pt-4 border-t border-slate-200 dark:border-slate-700">
               <button onClick={handleBack} className="w-full flex justify-center py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600 transform hover:scale-[1.02] transition-transform duration-200">Back</button>
                <button
                  onClick={handleGenerateEmails}
                  disabled={isGeneratingEmails || selectedContacts.size === 0}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400 dark:disabled:bg-slate-600 dark:disabled:from-slate-600 dark:disabled:to-slate-600 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-transform duration-200"
                >
                  {isGeneratingEmails ? <Loader /> : `Generate ${selectedContacts.size} Emails`}
                  {!isGeneratingEmails && <ChevronRightIcon />}
                </button>
            </div>
          </div>
        );
      case Step.Review:
        const unsentEmailCount = emails.filter(e => !e.sent).length;
        return (
           <div className="space-y-6">
            <h3 className="text-xl font-bold leading-6 text-slate-900 dark:text-white">Review and Send Emails</h3>

            <div className="p-4 bg-yellow-50/70 border-l-4 border-yellow-400 text-yellow-800 rounded-r-lg dark:bg-yellow-900/20 dark:border-yellow-500 dark:text-yellow-300">
                <p className="font-bold">Manual Action Required</p>
                <p className="text-sm">For your security, this app cannot automatically attach files. Please remember to attach your resume manually in your email client for each message.</p>
            </div>

            <button 
                onClick={handleSendAll}
                disabled={isSending || unsentEmailCount === 0}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400 dark:disabled:bg-slate-600 dark:disabled:from-slate-600 dark:disabled:to-slate-600 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-transform duration-200"
            >
                {isSending ? <Loader /> : (unsentEmailCount === 0 ? 'All Emails Sent' : `Send All (${unsentEmailCount}) Emails`)}
            </button>

            <div className="space-y-6 max-h-[32rem] overflow-y-auto pr-2 -mr-2">
                {emails.map((email, index) => (
                    <div key={email.to} className={`p-4 border border-slate-200 rounded-lg bg-white/50 shadow-md transition-opacity dark:bg-slate-800/50 dark:border-slate-700/80 ${email.sent ? 'opacity-60' : ''}`}>
                        <div className="mb-2">
                            <p className="text-sm text-slate-500 dark:text-slate-400">To: <span className="font-medium text-slate-800 dark:text-slate-200">{email.to}</span></p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Subject: <span className="font-medium text-slate-800 dark:text-slate-200">{email.subject}</span></p>
                        </div>
                        <textarea
                            value={email.body}
                            onChange={(e) => handleEmailChange(index, e.target.value)}
                            rows={10}
                            readOnly={email.sent}
                            className="block w-full text-sm p-3 bg-slate-50/50 border border-slate-300/70 rounded-md shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 dark:bg-slate-800/50 dark:border-slate-700/70 dark:text-slate-200 dark:focus:ring-indigo-500 dark:focus:border-indigo-500 dark:disabled:bg-slate-800"
                        />
                        <a
                            href={!email.sent ? `mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body + '\n\n(Remember to attach your resume!)')}` : undefined}
                            target="_blank" rel="noopener noreferrer"
                            className={`mt-3 inline-flex items-center justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white ${
                                email.sent 
                                ? 'bg-slate-500 dark:bg-slate-600 cursor-default' 
                                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform hover:scale-[1.02] transition-transform duration-150'
                            }`}
                        >
                            {email.sent ? 'Sent ✔' : 'Open in Email Client'}
                        </a>
                    </div>
                ))}
            </div>
             <button onClick={handleBack} className="w-full flex justify-center py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600 transform hover:scale-[1.02] transition-transform duration-200">Back</button>
           </div>
        );
    }
  };
  
   const HistoryItem: React.FC<{ entry: HistoryEntry }> = ({ entry }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="p-4 border border-slate-200/80 rounded-lg bg-white/50 shadow-md dark:bg-slate-800/50 dark:border-slate-700/80">
            <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-start">
                    <div className='flex-1'>
                        <p className="text-sm text-slate-500 dark:text-slate-400">To: <span className="font-medium text-slate-800 dark:text-slate-200">{entry.to}</span></p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Subject: <span className="font-medium text-slate-800 dark:text-slate-200">{entry.subject}</span></p>
                    </div>
                    <div className="text-right ml-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(entry.dateSent).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(entry.dateSent).toLocaleTimeString()}</p>
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50/50 p-3 rounded-md dark:bg-slate-900/50 dark:text-slate-300">{entry.body}</pre>
                </div>
            )}
        </div>
    );
  };

  const renderHistory = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
                <button onClick={() => setView('app')} className="flex items-center text-sm font-semibold text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors">
                    <ArrowLeftIcon />
                    <span className="ml-2">Back to App</span>
                </button>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Email History</h2>
                <button 
                    onClick={handleClearHistory} 
                    disabled={history.length === 0}
                    className="flex items-center text-sm font-semibold text-red-600 hover:text-red-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors dark:text-red-500 dark:hover:text-red-400 dark:disabled:text-slate-500"
                >
                    <TrashIcon />
                    <span className="ml-1">Clear</span>
                </button>
            </div>

            {history.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-slate-500 dark:text-slate-400">You haven't sent any emails yet.</p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Your sent email history will appear here.</p>
                </div>
            ) : (
                <div className="space-y-4 max-h-[40rem] overflow-y-auto pr-2 -mr-2">
                    {history.map((entry, index) => <HistoryItem key={`${entry.dateSent}-${index}`} entry={entry} />)}
                </div>
            )}
        </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto">
        <header className="mb-10 relative">
           <div className="absolute top-0 right-0 flex flex-col items-center space-y-2">
             <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-700 transition-colors duration-200"
                title="Toggle dark mode"
             >
                {isDarkMode ? <SunIcon /> : <MoonIcon />}
             </button>
             <button
                onClick={() => setView(v => v === 'app' ? 'history' : 'app')}
                className="p-2 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-700 transition-colors duration-200"
                title={view === 'app' ? "View History" : "Back to App"}
              >
               {view === 'app' ? <HistoryIcon /> : <ArrowLeftIcon />}
              </button>
           </div>
           <div className="text-center">
             <h1 className="text-4xl font-extrabold tracking-tighter text-slate-900 dark:text-white sm:text-5xl">Academic Outreach Assistant</h1>
             <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">Find academic contacts and draft personalized emails in minutes.</p>
           </div>
        </header>

        <main className="bg-white/60 backdrop-blur-2xl p-8 rounded-2xl shadow-2xl border border-slate-200/50 dark:bg-slate-800/60 dark:border-slate-700/50">
          {view === 'app' ? (
            <>
              <StepIndicator currentStep={currentStep} />
              <div className="mt-10">
                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm dark:bg-red-900/20 dark:text-red-300 dark:border-red-500/30">{error}</div>}
                {renderContent()}
              </div>
            </>
          ) : (
             renderHistory()
          )}
        </main>
         <footer className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
          <p>Powered by Gemini AI. Please review all generated content for accuracy.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;