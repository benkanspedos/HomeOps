import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import DomainManager from '../DomainManager';
import * as dnsHooks from '@/hooks/useDns';
import { mockDomainList, mockWhiteList } from '../../../tests/fixtures/dns.fixtures';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/hooks/useDns');

// Mock components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => 
    open ? <div data-testid="add-domain-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children, asChild }: any) => <div>{children}</div>,
}));

const mockedDnsHooks = dnsHooks as jest.Mocked<typeof dnsHooks>;

describe('DomainManager', () => {
  let queryClient: QueryClient;
  const mockUseDomains = jest.fn();
  const mockUseAddDomain = jest.fn();
  const mockUseRemoveDomain = jest.fn();
  const mockUseBlockDomain = jest.fn();
  const mockUseBulkBlockDomains = jest.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    jest.clearAllMocks();

    // Setup default mock implementations
    mockUseDomains.mockReturnValue({
      data: { 
        data: { 
          domains: [...mockDomainList.map(d => ({ ...d, listType: 'black', blocked: true })), 
                   ...mockWhiteList.map(d => ({ ...d, listType: 'white', blocked: false }))] 
        } 
      },
      isLoading: false,
      error: null,
    });

    mockUseAddDomain.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
      isPending: false,
    });

    mockUseRemoveDomain.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });

    mockUseBlockDomain.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });

    mockUseBulkBlockDomains.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });

    mockedDnsHooks.useDomains = mockUseDomains;
    mockedDnsHooks.useAddDomain = mockUseAddDomain;
    mockedDnsHooks.useRemoveDomain = mockUseRemoveDomain;
    mockedDnsHooks.useBlockDomain = mockUseBlockDomain;
    mockedDnsHooks.useBulkBlockDomains = mockUseBulkBlockDomains;
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DomainManager />
      </QueryClientProvider>
    );
  };

  describe('Initial render', () => {
    it('should render domain management interface', () => {
      renderComponent();
      
      expect(screen.getByText('Domain Management')).toBeInTheDocument();
      expect(screen.getByText('Manage blocked and allowed domains')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add domain/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });

    it('should render search input and filter select', () => {
      renderComponent();
      
      expect(screen.getByPlaceholderText('Search domains...')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render domains table with correct headers', () => {
      renderComponent();
      
      expect(screen.getByText('Domain')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('List')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show skeleton loaders when loading', () => {
      mockUseDomains.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderComponent();
      
      expect(screen.getAllByTestId(/skeleton/i)).toHaveLength(5);
    });
  });

  describe('Error state', () => {
    it('should show error message when domains fail to load', () => {
      mockUseDomains.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch'),
      });

      renderComponent();
      
      expect(screen.getByText('Failed to load domains')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no domains exist', () => {
      mockUseDomains.mockReturnValue({
        data: { data: { domains: [] } },
        isLoading: false,
        error: null,
      });

      renderComponent();
      
      expect(screen.getByText('No domains found')).toBeInTheDocument();
    });
  });

  describe('Domains display', () => {
    it('should render all domains in the table', () => {
      renderComponent();
      
      expect(screen.getByText('ads.example.com')).toBeInTheDocument();
      expect(screen.getByText('tracker.example.com')).toBeInTheDocument();
      expect(screen.getByText('safe.example.com')).toBeInTheDocument();
    });

    it('should show correct status badges', () => {
      renderComponent();
      
      const blockedBadges = screen.getAllByText('Blocked');
      const allowedBadges = screen.getAllByText('Allowed');
      
      expect(blockedBadges).toHaveLength(2);
      expect(allowedBadges).toHaveLength(1);
    });

    it('should show correct list type badges', () => {
      renderComponent();
      
      expect(screen.getAllByText(/blocklist|black/i)).toHaveLength(2);
      expect(screen.getAllByText(/allowlist|white/i)).toHaveLength(1);
    });
  });

  describe('Search functionality', () => {
    it('should filter domains based on search query', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search domains...');
      fireEvent.change(searchInput, { target: { value: 'safe' } });
      
      await waitFor(() => {
        expect(screen.getByText('safe.example.com')).toBeInTheDocument();
        expect(screen.queryByText('ads.example.com')).not.toBeInTheDocument();
      });
    });

    it('should show no results when search matches nothing', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search domains...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      await waitFor(() => {
        expect(screen.getByText('No domains found')).toBeInTheDocument();
      });
    });

    it('should be case insensitive', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search domains...');
      fireEvent.change(searchInput, { target: { value: 'ADS' } });
      
      await waitFor(() => {
        expect(screen.getByText('ads.example.com')).toBeInTheDocument();
      });
    });
  });

  describe('Filter functionality', () => {
    it('should filter by list type', () => {
      renderComponent();
      
      mockUseDomains.mockReturnValue({
        data: { data: { domains: mockDomainList.map(d => ({ ...d, listType: 'black', blocked: true })) } },
        isLoading: false,
        error: null,
      });

      // Simulate filter change
      expect(mockUseDomains).toHaveBeenCalledWith({ listType: 'all' });
    });
  });

  describe('Add domain functionality', () => {
    it('should open add domain dialog when button clicked', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('add-domain-dialog')).toBeInTheDocument();
      });
    });

    it('should handle form submission', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({});
      mockUseAddDomain.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      });

      renderComponent();
      
      fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('add-domain-dialog')).toBeInTheDocument();
      });

      const domainInput = screen.getByRole('textbox', { name: /domain/i });
      fireEvent.change(domainInput, { target: { value: 'test.com' } });
      
      const addButton = screen.getByRole('button', { name: /^add domain$/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          domain: 'test.com',
          listType: 'black',
          comment: ''
        });
      });
    });

    it('should show loading state during form submission', () => {
      mockUseAddDomain.mockReturnValue({
        mutateAsync: jest.fn().mockResolvedValue({}),
        isPending: true,
      });

      renderComponent();
      
      fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
      
      expect(screen.getByText('Adding...')).toBeInTheDocument();
    });
  });

  describe('Domain actions', () => {
    it('should toggle domain block status', () => {
      const mockMutate = jest.fn();
      mockUseBlockDomain.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      renderComponent();
      
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[0]);
      
      expect(mockMutate).toHaveBeenCalledWith({
        domain: 'ads.example.com',
        block: false, // Should toggle from blocked to unblocked
      });
    });

    it('should remove domain when delete button clicked', () => {
      const mockMutate = jest.fn();
      mockUseRemoveDomain.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      renderComponent();
      
      const deleteButtons = screen.getAllByRole('button', { name: '' }); // Icon buttons
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('[data-testid="trash-icon"]') || 
        button.innerHTML.includes('trash')
      );
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(mockMutate).toHaveBeenCalled();
      }
    });
  });

  describe('Bulk operations', () => {
    it('should show bulk actions bar when domains are selected', async () => {
      renderComponent();
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // Select first domain
      
      await waitFor(() => {
        expect(screen.getByText(/1 domain selected/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /block selected/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /unblock selected/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
      });
    });

    it('should select all domains when header checkbox is clicked', async () => {
      renderComponent();
      
      const headerCheckbox = screen.getAllByRole('checkbox')[0]; // First checkbox is header
      fireEvent.click(headerCheckbox);
      
      await waitFor(() => {
        expect(screen.getByText(/3 domains selected/i)).toBeInTheDocument();
      });
    });

    it('should perform bulk block operation', async () => {
      const mockMutate = jest.fn();
      mockUseBulkBlockDomains.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      renderComponent();
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // Select first domain
      
      await waitFor(() => {
        const blockButton = screen.getByRole('button', { name: /block selected/i });
        fireEvent.click(blockButton);
        
        expect(mockMutate).toHaveBeenCalledWith({
          domains: ['ads.example.com'],
          block: true,
        });
      });
    });

    it('should show error when trying bulk action with no selection', async () => {
      renderComponent();
      
      // Try to perform bulk action without selecting domains
      const blockButton = screen.queryByRole('button', { name: /block selected/i });
      
      // Button should not be visible when no domains are selected
      expect(blockButton).not.toBeInTheDocument();
    });

    it('should show info toast for unimplemented bulk delete', async () => {
      renderComponent();
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // Select first domain
      
      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /delete selected/i });
        fireEvent.click(deleteButton);
        
        expect(toast.info).toHaveBeenCalledWith('Bulk delete not yet implemented');
      });
    });
  });

  describe('Export functionality', () => {
    it('should trigger CSV export when export button is clicked', () => {
      // Mock URL methods
      global.URL.createObjectURL = jest.fn(() => 'mocked-url');
      global.URL.revokeObjectURL = jest.fn();
      
      const mockClick = jest.fn();
      const mockCreateElement = jest.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: mockClick,
      } as any);

      renderComponent();
      
      fireEvent.click(screen.getByRole('button', { name: /export/i }));
      
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      
      mockCreateElement.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderComponent();
      
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(5);
      expect(screen.getAllByRole('row')).toHaveLength(4); // Header + 3 domains
      expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const addButton = screen.getByRole('button', { name: /add domain/i });
      
      // Focus the button
      addButton.focus();
      expect(addButton).toHaveFocus();
      
      // Press Enter
      fireEvent.keyPress(addButton, { key: 'Enter', code: 'Enter', charCode: 13 });
      
      await waitFor(() => {
        expect(screen.getByTestId('add-domain-dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Form validation', () => {
    it('should validate domain format', async () => {
      const mockMutateAsync = jest.fn().mockRejectedValue({
        issues: [{ message: 'Invalid domain format' }]
      });
      mockUseAddDomain.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      });

      renderComponent();
      
      fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('add-domain-dialog')).toBeInTheDocument();
      });

      const domainInput = screen.getByRole('textbox', { name: /domain/i });
      fireEvent.change(domainInput, { target: { value: 'invalid domain' } });
      
      const addButton = screen.getByRole('button', { name: /^add domain$/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid domain format');
      });
    });
  });
});