import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { COURSES } from '@/data/courses';
import { CourseHeader } from '@/components/CourseHeader';

describe('CourseHeader', () => {
  const course = COURSES[1]; // DEMO201

  it('renders metadata with formatCourseTerm, bookmark button, and hover-reveal labels for all 5 controls', () => {
    const onToggleBookmark = vi.fn();
    const onDownloadSvg = vi.fn();
    const onOpenBackup = vi.fn();
    const onOpenExport = vi.fn();
    const onRequestDelete = vi.fn();
    const onChangeTab = vi.fn();

    render(
      <MemoryRouter>
        <CourseHeader
          course={course}
          bookmarked={false}
          activeTab="tree"
          onToggleBookmark={onToggleBookmark}
          onDownloadSvg={onDownloadSvg}
          onOpenBackup={onOpenBackup}
          onOpenExport={onOpenExport}
          onRequestDelete={onRequestDelete}
          onChangeTab={onChangeTab}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(course.code)).toBeInTheDocument();
    expect(screen.getByText(course.department)).toBeInTheDocument();
    expect(screen.getByText('Year 2 · 1st Semester')).toBeInTheDocument();
    expect(screen.getByText(`${course.credits} Credits`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: course.title })).toBeInTheDocument();

    const bookmarkBtn = screen.getByRole('button', { name: 'Bookmark course' });
    fireEvent.click(bookmarkBtn);
    expect(onToggleBookmark).toHaveBeenCalledTimes(1);

    const editLink = screen.getByRole('link', { name: 'Edit Course' });
    expect(editLink).toHaveAttribute('href', `/course/${course.slug}/edit`);
    expect(screen.getByText('Edit Course')).toHaveClass('max-w-0', 'opacity-0', 'group-hover/btn:opacity-100');

    const exportBtn = screen.getByRole('button', { name: 'Export Course' });
    expect(screen.getByText('Export Course')).toHaveClass('max-w-0', 'opacity-0', 'group-hover/btn:opacity-100');
    fireEvent.click(exportBtn);
    expect(onOpenExport).toHaveBeenCalledTimes(1);

    const backupBtn = screen.getByRole('button', { name: 'Backup Progress' });
    expect(screen.getByText('Backup Progress')).toHaveClass('max-w-0', 'opacity-0', 'group-hover/btn:opacity-100');
    fireEvent.click(backupBtn);
    expect(onOpenBackup).toHaveBeenCalledTimes(1);

    const svgBtn = screen.getByRole('button', { name: 'Download SVG' });
    expect(screen.getByText('Download SVG')).toHaveClass('max-w-0', 'opacity-0', 'group-hover/btn:opacity-100');
    fireEvent.click(svgBtn);
    expect(onDownloadSvg).toHaveBeenCalledTimes(1);

    const deleteBtn = screen.getByRole('button', { name: 'Delete Course' });
    expect(screen.getByText('Delete Course')).toHaveClass('max-w-0', 'opacity-0', 'group-hover/btn:opacity-100');
    fireEvent.click(deleteBtn);
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });

  it('toggles mobile horizontal slide-out tray positioned to the left of the collapse button and switches tabs', () => {
    const onChangeTab = vi.fn();

    const { container } = render(
      <MemoryRouter>
        <CourseHeader
          course={course}
          bookmarked={true}
          activeTab="tree"
          onToggleBookmark={vi.fn()}
          onDownloadSvg={vi.fn()}
          onOpenBackup={vi.fn()}
          onOpenExport={vi.fn()}
          onRequestDelete={vi.fn()}
          onChangeTab={onChangeTab}
        />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole('button', { name: 'Expand course actions' });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveAttribute('aria-controls', 'course-header-extra-actions');
    expect(toggleBtn).toHaveClass('sm:hidden');

    const tray = container.querySelector('#course-header-extra-actions') as HTMLElement;
    expect(tray).toBeInTheDocument();
    expect(tray).toHaveClass('max-w-0', 'invisible');

    // Tray sits immediately before the toggle button (reveals horizontally to the left)
    expect(tray.nextElementSibling).toBe(toggleBtn);

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Collapse course actions');
    expect(tray).toHaveClass('max-w-[calc(100vw-8.5rem)]', 'visible', 'overflow-x-auto');

    const checklistTab = screen.getByRole('tab', { name: /Syllabus Checklist/i });
    expect(checklistTab).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(checklistTab);
    expect(onChangeTab).toHaveBeenCalledWith('checklist');
  });
});
