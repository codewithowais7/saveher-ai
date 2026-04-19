
import Link from 'next/link';

export default function Page() {
  return (
    <>
      

<nav className="fixed top-0 w-full z-50 bg-[#0a0a0f]/60 backdrop-blur-3xl shadow-[0_0_40px_rgba(199,191,255,0.06)] h-20">
<div className="flex justify-between items-center max-w-7xl mx-auto px-8 h-full">
<div className="text-xl font-extrabold tracking-tighter text-white uppercase">SENTINEL AI</div>
<div className="hidden md:flex items-center space-x-8 font-['Inter'] font-semibold tracking-tight">
<Link className="text-white/60 hover:text-white/90 transition-colors" href="/">Overview</Link>
<Link className="text-[#c7bfff] border-b-2 border-[#7c6af7] pb-1" href="/how-it-works">How It Works</Link>
<Link className="text-white/60 hover:text-white/90 transition-colors" href="/">Technology</Link>
<Link className="text-white/60 hover:text-white/90 transition-colors" href="/">Safety Network</Link>
</div>
<div className="flex items-center space-x-6">
<Link href="/profile"><button className="bg-gradient-to-br from-[#c7bfff] to-[#8e7fff] text-[#180065] px-6 py-2.5 rounded-lg font-extrabold active:scale-95 duration-200 transition-all">
                    Get Protected
                </button></Link>
<span className="material-symbols-outlined text-white/60 hover:text-white cursor-pointer transition-colors" data-icon="account_circle">account_circle</span>
</div>
</div>
</nav>
<main className="pt-32 pb-24">

<section className="max-w-7xl mx-auto px-8 mb-32 text-center">
<div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-surface-container-high border border-outline-variant/20">
<span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">The Protocol</span>
</div>
<h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 leading-none">
                How It <span className="gradient-text">Works</span>
</h1>
<p className="max-w-2xl mx-auto text-xl text-white/60 font-medium leading-relaxed">
                The Veil remains unbroken. Our neural architecture operates in total silence, 
                detecting, analyzing, and neutralizing threats before they reach your digital perimeter.
            </p>
</section>

<section className="max-w-5xl mx-auto px-8 relative">

<div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#7c6af7]/0 via-[#7c6af7]/40 to-[#7c6af7]/0 hidden md:block transform -translate-x-1/2"></div>
<div className="space-y-32">

<div className="relative flex flex-col md:flex-row items-center justify-between group">
<div className="md:w-[45%] text-right order-2 md:order-1 mt-8 md:mt-0">
<h3 className="text-3xl font-extrabold text-white mb-4">Detection</h3>
<p className="text-white/60 leading-relaxed">
                            Continuous AI monitoring across social architectures. Our sensors identify harassment patterns, linguistic aggressive markers, and systematic stalking behavior in real-time.
                        </p>
</div>

<div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[#131318] border-2 border-primary shadow-[0_0_20px_rgba(124,106,247,0.4)] order-1 md:order-2">
<span className="material-symbols-outlined text-primary text-xl" data-icon="radar">radar</span>
</div>
<div className="md:w-[45%] order-3 overflow-hidden rounded-xl border border-white/5">
<img className="w-full h-64 object-cover grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-700" data-alt="Abstract visualization of data streams and glowing digital radar signals in a dark tech aesthetic" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvqUH3_MZiU91WKD49q-N9zUnbgfhrQi-BI6kSyLEJt15komPJc6FtAtqCAQXiohbk4X3hm9LHudYBbgUTemlVCJ1gpClK_FuGGZyFy4JiaQYMeoOFXNqoruCjZ4KF27w3DE7u6RA9i1thSDnr9rVW0cYLqVcXAzWL2ZuONpAEP67tX5_LdKPS7QMae5OqEo80gBtoSBZ4jVb_gKSNgXj_7NUodVFoiifxNQ5m03te9U2owxB_YtnrlhdUfv6r-oDJ24JhoQ99sKY"/>
</div>
</div>

<div className="relative flex flex-col md:flex-row items-center justify-between group">
<div className="md:w-[45%] order-3 md:order-1 overflow-hidden rounded-xl border border-white/5">
<img className="w-full h-64 object-cover grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-700" data-alt="Microscopic view of neural network connections with violet light pulses and complex data architecture" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxQqkrY7jPBEQrGibeVpFNHX87vkJKYcoAlBzw4fPjhMMrs1F3X3WrbzU-tCJsX9uIGUjdL3-mtlvUzAL-dgGVUPHMtHjVGPS38IxwRTe72ARw0zqKvEadduxj5ciRj0C3q2PF1OWP1c4TtWY27wThCmKJIWXbkj-XwAEgLfkYEtP3MkTG_ciUZrj4LqoYd7ZKkE30nAhzEyvYk4CPbJ1M3MSB27rTVyE25gXPh4OBxxrsiT6DJ-KkZQ2wzwQe2VuGJKQZy4mJwck"/>
</div>

<div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[#131318] border-2 border-primary shadow-[0_0_20px_rgba(124,106,247,0.4)] order-2">
<span className="material-symbols-outlined text-primary text-xl" data-icon="psychology">psychology</span>
</div>
<div className="md:w-[45%] text-left mt-8 md:mt-0 order-1 md:order-3">
<h3 className="text-3xl font-extrabold text-white mb-4">Analysis</h3>
<p className="text-white/60 leading-relaxed">
                            The Neural Engine evaluates threat escalation levels. It categorizes content based on psychological impact and severity, separating noise from targeted digital violence.
                        </p>
</div>
</div>

<div className="relative flex flex-col md:flex-row items-center justify-between group">
<div className="md:w-[45%] text-right order-2 md:order-1 mt-8 md:mt-0">
<h3 className="text-3xl font-extrabold text-white mb-4">Documentation</h3>
<p className="text-white/60 leading-relaxed">
                            Automatic generation of legally compliant dossier. Our system maps evidence directly to relevant sections of the IT Act, preparing professional complaint drafts for judicial submission.
                        </p>
</div>

<div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[#131318] border-2 border-primary shadow-[0_0_20px_rgba(124,106,247,0.4)] order-1 md:order-2">
<span className="material-symbols-outlined text-primary text-xl" data-icon="gavel">gavel</span>
</div>
<div className="md:w-[45%] order-3 overflow-hidden rounded-xl border border-white/5">
<img className="w-full h-64 object-cover grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-700" data-alt="Elegant close up of high-end dark paperwork with subtle glowing violet highlights on text lines" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDGYTo2J3RxjJ5ZHLeWnusrQ-HCVJD2jEUgKHTRFNO4UXtByO1oOH5ros7qbTschVB6DSc45fq_7MBmwvlkQy_Oe_4H9mOmiPtFbL8haMMIZMLpavdyM7k6PCVXWA48L80cTyD3RQER3RSrc9Wi8j3CobbThpJi69qd0RbZ7RoH_fjvx2qxE67k4myVy50hF8KshILyb0eXTYtJz-SVOSo-GRa5I0849X4IXdcTFBtaRP3lRCaZywdGVja2MlE_fVVH4s3mMk1c130"/>
</div>
</div>

<div className="relative flex flex-col md:flex-row items-center justify-between group">
<div className="md:w-[45%] order-3 md:order-1 overflow-hidden rounded-xl border border-white/5">
<img className="w-full h-64 object-cover grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-700" data-alt="Digital shield icon floating in a dark server room with beams of purple light protecting a central core" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDOMko-vxn3vBaLQ8oadSci48ipcsC5lBEluHIRlHUSvcOax6ThA6Z1ZxwdQC6d1yo6GlOwwwO2EjkI-cZn9dFvLC_RrK6lfBtrduX7ghwGrs1rFnD_LbMgJTQc2SeJkeaSvdNWz0v9wmP6m2e1OzTWEOzS3u8sTDEtgNcYkpPoqUU6lvECCspnKdDRN9THBNhHVFD3FGmC7SDZfdwHQba2nVhr3bMRWmrMfmanTkGQRADUl45fysfb3kDkNpa9b0jwHA0TVPEupMg"/>
</div>

<div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[#131318] border-2 border-primary shadow-[0_0_20px_rgba(124,106,247,0.4)] order-2">
<span className="material-symbols-outlined text-primary text-xl" data-icon="security">security</span>
</div>
<div className="md:w-[45%] text-left mt-8 md:mt-0 order-1 md:order-3">
<h3 className="text-3xl font-extrabold text-white mb-4">Action</h3>
<p className="text-white/60 leading-relaxed">
                            Empowerment through protocol. Execute automated reporting, trigger immediate blocks, or activate SOS protocols that alert your trusted safety network with one command.
                        </p>
</div>
</div>
</div>
</section>

<section className="max-w-7xl mx-auto px-8 mt-48 text-center">
<div className="glass-panel p-16 rounded-[2rem] relative overflow-hidden">
<div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[120px] rounded-full -mr-48 -mt-48"></div>
<div className="relative z-10">
<h2 className="text-4xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">The Veil Awaits Your Command.</h2>
<p className="text-white/40 uppercase tracking-[0.3em] font-semibold mb-12">Total protection, no compromise.</p>
<button className="px-10 py-5 bg-gradient-to-br from-[#c7bfff] to-[#8e7fff] text-[#180065] rounded-xl text-lg font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_0_40px_rgba(199,191,255,0.2)]">
                        Start Protecting Yourself
                    </button>
</div>
</div>
</section>
</main>

<footer className="w-full border-t border-white/5 bg-[#0a0a0f]">
<div className="flex flex-col md:flex-row justify-between items-center px-12 py-16 w-full max-w-7xl mx-auto">
<div className="mb-8 md:mb-0">
<div className="text-lg font-black text-white mb-2 uppercase">SENTINEL AI</div>
<p className="font-['Inter'] text-sm uppercase tracking-widest font-semibold text-white/40">© 2026 SENTINEL AI. THE VEIL REMAINS UNBROKEN.</p>
</div>
<div className="flex flex-wrap justify-center gap-8 font-['Inter'] text-sm uppercase tracking-widest font-semibold">
<Link className="text-white/40 hover:text-[#c7bfff] transition-colors" href="/">Privacy Protocol</Link>
<Link className="text-white/40 hover:text-[#c7bfff] transition-colors" href="/">Terms of Service</Link>
<Link className="text-white/40 hover:text-[#c7bfff] transition-colors" href="/">AI Ethics</Link>
<Link className="text-white/40 hover:text-[#c7bfff] transition-colors" href="/">Global Support</Link>
</div>
</div>
</footer>

    </>
  );
}
