import type { CourseTree } from '@/types/course';

export const cs301OperatingSystems: CourseTree = {
  slug: 'cs301-operating-systems',
  code: 'CS301',
  title: 'Operating Systems',
  department: 'Computer Science',
  semester: 'Year 3 · Spring',
  credits: 4,
  description:
    'Explore how operating systems virtualize CPUs and memory, coordinate concurrent threads safely, and manage durable storage.',
  chapters: [
    {
      id: 'cs301-ch1-processes',
      order: 1,
      title: '1. Processes & Scheduling',
      weekRange: 'Weeks 1–3',
      description:
        'User vs. kernel mode, system calls, process control blocks, context switching, and CPU scheduling policies.',
      lessons: [
        {
          id: 'cs301-syscalls-trap',
          title: 'System Calls & Traps',
          summary:
            'Trace how limited direct execution safely transitions between user space and kernel space via hardware traps.',
          notes:
            'Key takeaways:\n- Hardware timer interrupts let the OS regain CPU control from runaway processes.\n- Trap tables are configured by the kernel at boot time.',
          side: 'left',
          estimatedMinutes: 45,
          resources: [
            {
              title: 'OSTEP Ch. 6: Limited Direct Execution',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf',
              kind: 'textbook',
            },
            {
              title: 'Lecture 01 Slides: Kernel Mode & Traps',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
              kind: 'slides',
            },
          ],
        },
        {
          id: 'cs301-process-api',
          title: 'Process API (fork/exec)',
          summary:
            'Create, replace, and synchronize processes in POSIX using fork(), exec(), wait(), and file descriptor redirection.',
          notes:
            'Key takeaways:\n- Separating fork() and exec() makes shell pipelines and I/O redirection clean.\n- Always reap child processes with wait() to avoid zombies.',
          side: 'right',
          prerequisites: ['cs301-syscalls-trap'],
          estimatedMinutes: 55,
          resources: [
            {
              title: 'Lab 01: Build a Mini Unix Shell',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf',
              kind: 'lab',
            },
            {
              title: 'OSTEP Ch. 5: Process API',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf',
              kind: 'textbook',
            },
          ],
        },
        {
          id: 'cs301-cpu-scheduling',
          title: 'CPU Scheduling & MLFQ',
          summary:
            'Evaluate turnaround time vs. response time across FIFO, SJF, Round Robin, and Multi-Level Feedback Queues.',
          notes:
            'Key takeaways:\n- Priority boost prevents starvation in MLFQ.\n- Short time slices improve interactivity at the cost of higher context-switch overhead.',
          side: 'left',
          prerequisites: ['cs301-process-api'],
          estimatedMinutes: 50,
          resources: [
            {
              title: 'OSTEP Ch. 8: Multi-Level Feedback Queue',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf',
              kind: 'textbook',
            },
            {
              title: 'Scheduling Trace Problem Set',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
              kind: 'assignment',
            },
          ],
        },
      ],
    },
    {
      id: 'cs301-ch2-concurrency',
      order: 2,
      title: '2. Concurrency & Locks',
      weekRange: 'Weeks 4–6',
      description:
        'Shared-memory threads, race conditions, mutexes, condition variables, semaphores, and deadlock prevention.',
      lessons: [
        {
          id: 'cs301-threads-races',
          title: 'Threads & Race Conditions',
          summary:
            'Understand shared address spaces, per-thread stacks, critical sections, and atomic hardware primitives.',
          side: 'left',
          prerequisites: ['cs301-process-api'],
          estimatedMinutes: 45,
          resources: [
            {
              title: 'OSTEP Ch. 26: Concurrency Intro',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf',
              kind: 'textbook',
            },
          ],
        },
        {
          id: 'cs301-mutex-condvars',
          title: 'Locks & Condition Vars',
          summary:
            'Build spinlocks, futex-style sleeping locks, and bounded producer-consumer queues using condition variables.',
          notes:
            'Key takeaways:\n- Always check condition predicates in a while loop (Mesa semantics), never an if statement.\n- Hold the associated mutex while waiting and signaling.',
          side: 'right',
          prerequisites: ['cs301-threads-races'],
          estimatedMinutes: 65,
          resources: [
            {
              title: 'Lab 02: Thread-Safe Bounded Queue',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf',
              kind: 'lab',
            },
            {
              title: 'OSTEP Ch. 30: Condition Variables',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf',
              kind: 'textbook',
            },
          ],
        },
        {
          id: 'cs301-deadlocks',
          title: 'Deadlocks & Avoidance',
          summary:
            'Identify the four Coffman conditions and prevent deadlocks via total lock ordering and try-lock backoff.',
          side: 'left',
          prerequisites: ['cs301-mutex-condvars'],
          estimatedMinutes: 45,
          resources: [
            {
              title: 'OSTEP Ch. 32: Common Concurrency Problems',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf',
              kind: 'textbook',
            },
            {
              title: 'Midterm Review: Concurrency & Synchronization',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
              kind: 'exam',
            },
          ],
        },
      ],
    },
    {
      id: 'cs301-ch3-memory',
      order: 3,
      title: '3. Virtual Memory',
      weekRange: 'Weeks 7–9',
      description:
        'Address translation, multi-level page tables, TLB caching, demand paging, and replacement algorithms.',
      lessons: [
        {
          id: 'cs301-paging-tlb',
          title: 'Paging & the TLB',
          summary:
            'Translate virtual page numbers to physical frames and see why the TLB makes paging fast in practice.',
          side: 'left',
          prerequisites: ['cs301-syscalls-trap'],
          estimatedMinutes: 60,
          resources: [
            {
              title: 'OSTEP Ch. 19: Faster Translations (TLBs)',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf',
              kind: 'textbook',
            },
            {
              title: 'Lecture 08 Slides: Multi-Level Page Tables',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/vm-smalltables.pdf',
              kind: 'slides',
            },
          ],
        },
        {
          id: 'cs301-page-replacement',
          title: 'Page Replacement Policies',
          summary:
            'Compare Optimal (Belady), FIFO, LRU, and Clock approximation algorithms under memory pressure.',
          side: 'right',
          prerequisites: ['cs301-paging-tlb'],
          estimatedMinutes: 50,
          resources: [
            {
              title: 'Lab 03: Page Replacement Simulator',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf',
              kind: 'lab',
            },
          ],
        },
        {
          id: 'cs301-copy-on-write',
          title: 'Copy-on-Write & mmap',
          summary:
            'Leverage page faults for fast fork() via copy-on-write and memory-mapped file I/O with mmap().',
          side: 'left',
          prerequisites: ['cs301-paging-tlb', 'cs301-process-api'],
          estimatedMinutes: 45,
          resources: [
            {
              title: 'Linux mmap(2) Official Man Page',
              url: 'https://man7.org/linux/man-pages/man2/mmap.2.html',
              kind: 'official',
            },
          ],
        },
      ],
    },
    {
      id: 'cs301-ch4-storage',
      order: 4,
      title: '4. File Systems & Storage',
      weekRange: 'Weeks 10–13',
      description:
        'Inodes, directories, block allocation, crash consistency, journaling, and SSD/NVMe fundamentals.',
      lessons: [
        {
          id: 'cs301-inodes-directories',
          title: 'Inodes & Directories',
          summary:
            'Inspect how Unix file systems separate filenames from inode metadata, direct/indirect pointers, and hard links.',
          side: 'left',
          estimatedMinutes: 50,
          resources: [
            {
              title: 'OSTEP Ch. 40: File System Implementation',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf',
              kind: 'textbook',
            },
          ],
        },
        {
          id: 'cs301-crash-consistency',
          title: 'Journaling & Crash Recovery',
          summary:
            'Prevent file system corruption across power failures using write-ahead logging (journaling) and fsck.',
          side: 'right',
          prerequisites: ['cs301-inodes-directories'],
          estimatedMinutes: 55,
          resources: [
            {
              title: 'OSTEP Ch. 42: Crash Consistency (FSCK & Journaling)',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/file-journaling.pdf',
              kind: 'textbook',
            },
          ],
        },
        {
          id: 'cs301-ssd-flash',
          title: 'Flash SSDs & Wear Leveling',
          summary:
            'Understand erase-before-program blocks, Flash Translation Layers (FTL), write amplification, and TRIM.',
          side: 'left',
          prerequisites: ['cs301-inodes-directories'],
          estimatedMinutes: 45,
          resources: [
            {
              title: 'OSTEP Ch. 44: Flash-based SSDs',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/file-ssd.pdf',
              kind: 'textbook',
            },
            {
              title: 'Final Exam Review: VM & File Systems',
              url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
              kind: 'exam',
            },
          ],
        },
      ],
    },
  ],
};
